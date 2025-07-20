import { describe, it } from "node:test";
import assert from "node:assert";
import { diff } from "../src/domain/photoDiff";

describe("photoDiff", () => {
  it("should return elements that are in include but not in exclude", () => {
    const include = ["1", "2", "3", "4", "5"];
    const exclude = ["3", "4", "6"];
    const result = diff(include, exclude);
    assert.deepStrictEqual(result, ["1", "2", "5"]);
  });

  it("should return an empty array if all elements are excluded", () => {
    const include = ["1", "2", "3"];
    const exclude = ["1", "2", "3", "4"];
    const result = diff(include, exclude);
    assert.deepStrictEqual(result, []);
  });

  it("should return all elements from include if exclude is empty", () => {
    const include = ["1", "2", "3"];
    const exclude: string[] = [];
    const result = diff(include, exclude);
    assert.deepStrictEqual(result, ["1", "2", "3"]);
  });

  it("should handle duplicate elements correctly", () => {
    const include = ["1", "2", "2", "3"];
    const exclude = ["2"];
    const result = diff(include, exclude);
    assert.deepStrictEqual(result, ["1", "3"]);
  });

  it("should return an empty array if include is empty", () => {
    const include: string[] = [];
    const exclude = ["1", "2", "3"];
    const result = diff(include, exclude);
    assert.deepStrictEqual(result, []);
  });
});
