import { isDeepStrictEqual } from "node:util";

const ANNOTATION_KEYWORDS = new Set([
  "$schema",
  "$id",
  "$comment",
  "title",
  "description",
  "default",
  "examples",
  "deprecated",
  "readOnly",
  "writeOnly",
]);

const SUPPORTED_KEYWORDS = new Set([
  ...ANNOTATION_KEYWORDS,
  "$defs",
  "$ref",
  "type",
  "const",
  "enum",
  "required",
  "properties",
  "additionalProperties",
  "propertyNames",
  "items",
  "minItems",
  "maxItems",
  "uniqueItems",
  "minLength",
  "maxLength",
  "pattern",
  "format",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "minProperties",
  "maxProperties",
  "allOf",
  "anyOf",
  "oneOf",
  "not",
  "if",
  "then",
  "else",
]);

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function dataType(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (Number.isInteger(value)) return "integer";
  return typeof value === "number" ? "number" : typeof value;
}

function matchesType(value, expected) {
  if (expected === "integer") return Number.isInteger(value);
  if (expected === "number") return typeof value === "number" && Number.isFinite(value);
  if (expected === "object") return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  if (expected === "array") return Array.isArray(value);
  if (expected === "null") return value === null;
  return typeof value === expected;
}

function decodePointerPart(part) {
  return part.replace(/~1/g, "/").replace(/~0/g, "~");
}

function resolveLocalRef(rootSchema, ref) {
  if (!ref.startsWith("#/")) {
    throw new Error(`Only local JSON Schema refs are supported; got '${ref}'`);
  }
  let current = rootSchema;
  for (const part of ref.slice(2).split("/").map(decodePointerPart)) {
    if (!current || !Object.prototype.hasOwnProperty.call(current, part)) {
      throw new Error(`Unresolvable JSON Schema ref '${ref}'`);
    }
    current = current[part];
  }
  return current;
}

function assertSupportedSchemaNode(schema, path, seen) {
  if (typeof schema === "boolean") return;
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    throw new Error(`${path} must be a JSON Schema object or boolean`);
  }
  if (seen.has(schema)) return;
  seen.add(schema);
  for (const key of Object.keys(schema)) {
    if (!SUPPORTED_KEYWORDS.has(key)) {
      throw new Error(`${path} uses unsupported JSON Schema keyword '${key}'`);
    }
  }
  for (const [key, child] of Object.entries(schema.$defs || {})) {
    assertSupportedSchemaNode(child, `${path}.$defs.${key}`, seen);
  }
  for (const [key, child] of Object.entries(schema.properties || {})) {
    assertSupportedSchemaNode(child, `${path}.properties.${key}`, seen);
  }
  if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
    assertSupportedSchemaNode(schema.additionalProperties, `${path}.additionalProperties`, seen);
  }
  for (const keyword of ["propertyNames", "items", "not", "if", "then", "else"]) {
    if (schema[keyword] !== undefined) {
      assertSupportedSchemaNode(schema[keyword], `${path}.${keyword}`, seen);
    }
  }
  for (const keyword of ["allOf", "anyOf", "oneOf"]) {
    for (const [index, child] of (schema[keyword] || []).entries()) {
      assertSupportedSchemaNode(child, `${path}.${keyword}[${index}]`, seen);
    }
  }
}

export function assertSupportedSchema(schema, label = "schema") {
  assertSupportedSchemaNode(schema, label, new Set());
}

export function validateJsonSchema(schema, value, label = "value") {
  assertSupportedSchema(schema, `${label} schema`);
  const rootSchema = schema;

  function validate(node, data, path) {
    if (node === true) return [];
    if (node === false) return [`${path} is rejected by a false schema`];
    const errors = [];

    if (node.$ref) {
      errors.push(...validate(resolveLocalRef(rootSchema, node.$ref), data, path));
    }

    for (const subSchema of node.allOf || []) {
      errors.push(...validate(subSchema, data, path));
    }
    if (node.anyOf) {
      const results = node.anyOf.map((subSchema) => validate(subSchema, data, path));
      if (!results.some((result) => result.length === 0)) {
        errors.push(`${path} must match at least one anyOf branch`);
      }
    }
    if (node.oneOf) {
      const matches = node.oneOf.filter((subSchema) => validate(subSchema, data, path).length === 0).length;
      if (matches !== 1) errors.push(`${path} must match exactly one oneOf branch; matched ${matches}`);
    }
    if (node.not && validate(node.not, data, path).length === 0) {
      errors.push(`${path} must not match the forbidden schema`);
    }
    if (node.if) {
      const conditionMatches = validate(node.if, data, path).length === 0;
      if (conditionMatches && node.then) errors.push(...validate(node.then, data, path));
      if (!conditionMatches && node.else) errors.push(...validate(node.else, data, path));
    }

    if (node.const !== undefined && !isDeepStrictEqual(data, node.const)) {
      errors.push(`${path} must equal ${JSON.stringify(node.const)}`);
    }
    if (node.enum && !node.enum.some((candidate) => isDeepStrictEqual(data, candidate))) {
      errors.push(`${path} is not one of the allowed enum values`);
    }
    if (node.type) {
      const expectedTypes = Array.isArray(node.type) ? node.type : [node.type];
      if (!expectedTypes.some((expected) => matchesType(data, expected))) {
        errors.push(`${path} must be ${expectedTypes.join(" or ")}; got ${dataType(data)}`);
        return errors;
      }
    }

    if (typeof data === "string") {
      if (node.minLength !== undefined && [...data].length < node.minLength) {
        errors.push(`${path} must have at least ${node.minLength} characters`);
      }
      if (node.maxLength !== undefined && [...data].length > node.maxLength) {
        errors.push(`${path} must have at most ${node.maxLength} characters`);
      }
      if (node.pattern !== undefined && !new RegExp(node.pattern, "u").test(data)) {
        errors.push(`${path} does not match /${node.pattern}/`);
      }
      if (node.format === "uri") {
        try {
          const parsed = new URL(data);
          if (!parsed.protocol) throw new Error("missing protocol");
        } catch {
          errors.push(`${path} must be an absolute URI`);
        }
      }
    }

    if (typeof data === "number" && Number.isFinite(data)) {
      if (node.minimum !== undefined && data < node.minimum) errors.push(`${path} must be >= ${node.minimum}`);
      if (node.maximum !== undefined && data > node.maximum) errors.push(`${path} must be <= ${node.maximum}`);
      if (node.exclusiveMinimum !== undefined && data <= node.exclusiveMinimum) {
        errors.push(`${path} must be > ${node.exclusiveMinimum}`);
      }
      if (node.exclusiveMaximum !== undefined && data >= node.exclusiveMaximum) {
        errors.push(`${path} must be < ${node.exclusiveMaximum}`);
      }
      if (node.multipleOf !== undefined && Math.abs(data / node.multipleOf - Math.round(data / node.multipleOf)) > 1e-12) {
        errors.push(`${path} must be a multiple of ${node.multipleOf}`);
      }
    }

    if (Array.isArray(data)) {
      if (node.minItems !== undefined && data.length < node.minItems) errors.push(`${path} needs at least ${node.minItems} items`);
      if (node.maxItems !== undefined && data.length > node.maxItems) errors.push(`${path} allows at most ${node.maxItems} items`);
      if (node.uniqueItems) {
        const values = data.map(canonical);
        if (new Set(values).size !== values.length) errors.push(`${path} items must be unique`);
      }
      if (node.items !== undefined) {
        data.forEach((item, index) => errors.push(...validate(node.items, item, `${path}[${index}]`)));
      }
    }

    if (data && typeof data === "object" && !Array.isArray(data)) {
      const keys = Object.keys(data);
      if (node.minProperties !== undefined && keys.length < node.minProperties) errors.push(`${path} needs at least ${node.minProperties} properties`);
      if (node.maxProperties !== undefined && keys.length > node.maxProperties) errors.push(`${path} allows at most ${node.maxProperties} properties`);
      for (const required of node.required || []) {
        if (!Object.prototype.hasOwnProperty.call(data, required)) errors.push(`${path}.${required} is required`);
      }
      for (const [key, child] of Object.entries(node.properties || {})) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          errors.push(...validate(child, data[key], `${path}.${key}`));
        }
      }
      if (node.propertyNames) {
        for (const key of keys) errors.push(...validate(node.propertyNames, key, `${path} property '${key}'`));
      }
      const declared = new Set(Object.keys(node.properties || {}));
      for (const key of keys.filter((candidate) => !declared.has(candidate))) {
        if (node.additionalProperties === false) {
          errors.push(`${path}.${key} is not allowed`);
        } else if (node.additionalProperties && typeof node.additionalProperties === "object") {
          errors.push(...validate(node.additionalProperties, data[key], `${path}.${key}`));
        }
      }
    }

    return errors;
  }

  return validate(schema, value, label);
}

export function assertValidJsonSchema(schema, value, label = "value") {
  const errors = validateJsonSchema(schema, value, label);
  if (errors.length) {
    const shown = errors.slice(0, 20);
    const suffix = errors.length > shown.length ? `\n… ${errors.length - shown.length} more error(s)` : "";
    throw new Error(`${label} failed JSON Schema validation:\n${shown.join("\n")}${suffix}`);
  }
}
