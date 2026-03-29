import { describe, expect, it } from "vitest";
import { cleanNodePayload } from "@/lib/runtime-presenters";

describe("cleanNodePayload", () => {
  it("unwraps single key payload shells", () => {
    expect(cleanNodePayload({ inputs: { a: 1 } })).toEqual({ a: 1 });
    expect(cleanNodePayload({ payload: { a: 1, b: 2 } })).toEqual({ a: 1, b: 2 });
    expect(cleanNodePayload({ output: { result: "ok" } })).toEqual({ result: "ok" });
  });

  it("filters out system internal keys", () => {
    expect(
      cleanNodePayload({
        __system: "internal",
        node_id: "node-1",
        sys_metadata: {},
        business_key: "value"
      })
    ).toEqual({ business_key: "value" });
  });

  it("returns null or original if empty or invalid", () => {
    expect(cleanNodePayload(null)).toBe(null);
    expect(cleanNodePayload(undefined)).toBe(null);
    expect(cleanNodePayload({ inputs: "string-is-not-object" })).toEqual({ inputs: "string-is-not-object" });
  });
});
