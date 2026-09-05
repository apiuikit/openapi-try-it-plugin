import type { OpenAPIDocumentData, OpenAPIOperationData, OpenAPIParameterData, HttpMethod } from "apiuikit/plugin";
import { resolveSchemaObject } from "./schemaRef";
import type { ArrayQueryStyle, Deref, EditableParamRow, ParamLocation } from "./types";

let nextId = 0;
function makeId(): string {
  nextId += 1;
  return `row-${nextId}`;
}

/** Path-item-level `parameters` apply to every method on that path; an
 * operation's own `parameters` add to (or, matched on `in`+`name`, override)
 * them. Reimplemented here rather than imported — apiuikit/plugin
 * deliberately doesn't pre-extract parameters (see
 * `OpenAPIOperationPluginContext`'s doc comment), so every plugin resolves
 * this itself from the raw `document`. */
export function resolveOperationParameters(
  document: OpenAPIDocumentData,
  method: HttpMethod,
  path: string,
): OpenAPIParameterData[] {
  const pathItem = document.paths?.[path];
  const operation: OpenAPIOperationData | undefined = pathItem?.[method];
  const pathLevel = pathItem?.parameters ?? [];
  const operationLevel = operation?.parameters ?? [];

  const merged = new Map<string, OpenAPIParameterData>();
  for (const param of pathLevel) merged.set(`${param.in}:${param.name}`, param);
  for (const param of operationLevel) merged.set(`${param.in}:${param.name}`, param);
  return Array.from(merged.values());
}

function exampleValue(param: OpenAPIParameterData, deref: Deref): string {
  if (param.example !== undefined) return String(param.example);
  if (param.examples) {
    for (const example of Object.values(param.examples)) {
      if (example && typeof example === "object" && "value" in example && example.value !== undefined) {
        return String(example.value);
      }
    }
  }
  const schema = resolveSchemaObject(param.schema, deref);
  if (schema?.example !== undefined) return String(schema.example);
  if (schema?.default !== undefined) return String(schema.default);
  return "";
}

function isDeepObject(param: OpenAPIParameterData, deref: Deref): boolean {
  const p = param as OpenAPIParameterData & { style?: string };
  if (p.style === "deepObject") return true;
  const schema = resolveSchemaObject(param.schema, deref);
  return param.in === "query" && schema?.type === "object";
}

function deepObjectKeys(param: OpenAPIParameterData, deref: Deref): string[] {
  const schema = resolveSchemaObject(param.schema, deref);
  const properties = schema?.properties;
  return properties && typeof properties === "object" ? Object.keys(properties) : [];
}

function isArrayParam(param: OpenAPIParameterData, deref: Deref): boolean {
  const schema = resolveSchemaObject(param.schema, deref);
  return param.in === "query" && schema?.type === "array";
}

/** OpenAPI's default for `explode` is `true` when `style` is `form`
 * (the default style itself) and `false` for every other style — per the
 * spec table, not an arbitrary choice. `spaceDelimited`/`pipeDelimited`
 * only mean anything when *not* exploded (exploded, they degenerate to
 * plain repeated `form` params). */
function arrayStyleAndExplode(param: OpenAPIParameterData): { style: ArrayQueryStyle; explode: boolean } {
  const p = param as OpenAPIParameterData & { style?: string; explode?: boolean };
  const style: ArrayQueryStyle = p.style === "spaceDelimited" || p.style === "pipeDelimited" ? p.style : "form";
  const explode = p.explode ?? style === "form";
  return { style, explode };
}

function arrayExampleValues(param: OpenAPIParameterData, deref: Deref): string[] {
  if (Array.isArray(param.example)) return param.example.map(String);
  const schema = resolveSchemaObject(param.schema, deref);
  if (Array.isArray(schema?.example)) return schema.example.map(String);
  if (Array.isArray(schema?.default)) return schema.default.map(String);
  return [];
}

export function buildRowsFromParameters(parameters: OpenAPIParameterData[], location: ParamLocation, deref: Deref): EditableParamRow[] {
  return parameters
    .filter((param) => param.in === location)
    .map((param) => {
      if (location === "query" && isDeepObject(param, deref)) {
        return {
          id: makeId(),
          in: location,
          name: param.name,
          value: "",
          enabled: !!param.required,
          fromSpec: true,
          required: param.required,
          description: param.description,
          deepObject: true,
          deepObjectEntries: deepObjectKeys(param, deref).map((key) => ({
            id: makeId(),
            key,
            value: "",
            enabled: false,
          })),
          param,
        } satisfies EditableParamRow;
      }
      if (location === "query" && isArrayParam(param, deref)) {
        const { style, explode } = arrayStyleAndExplode(param);
        const examples = arrayExampleValues(param, deref);
        const seededValues = examples.length > 0 ? examples : [""];
        return {
          id: makeId(),
          in: location,
          name: param.name,
          value: "",
          enabled: !!param.required || examples.length > 0,
          fromSpec: true,
          required: param.required,
          description: param.description,
          isArray: true,
          arrayStyle: style,
          arrayExplode: explode,
          arrayValues: seededValues.map((value) => ({ id: makeId(), value, enabled: value !== "" })),
          param,
        } satisfies EditableParamRow;
      }
      const value = exampleValue(param, deref);
      return {
        id: makeId(),
        in: location,
        name: param.name,
        value,
        enabled: !!param.required || value !== "",
        fromSpec: true,
        required: param.required,
        description: param.description,
        param,
      } satisfies EditableParamRow;
    });
}

/** Header rows get a couple of sensible defaults on top of whatever the spec
 * declares, matching what most API docs tools (including Scalar) pre-fill:
 * an `accept` row seeded from the operation's declared response content
 * types, enabled by default so a JSON API's response comes back readable. */
export function buildDefaultHeaderRows(operation: OpenAPIOperationData | undefined): EditableParamRow[] {
  const rows: EditableParamRow[] = [];
  const accepts = new Set<string>();
  for (const response of Object.values(operation?.responses ?? {})) {
    for (const contentType of Object.keys(response.content ?? {})) accepts.add(contentType);
  }
  if (accepts.size > 0) {
    rows.push({
      id: makeId(),
      in: "header",
      name: "accept",
      value: Array.from(accepts).join(", "),
      enabled: true,
      fromSpec: false,
    });
  }
  return rows;
}

export function newBlankRow(location: ParamLocation): EditableParamRow {
  return { id: makeId(), in: location, name: "", value: "", enabled: true, fromSpec: false };
}
