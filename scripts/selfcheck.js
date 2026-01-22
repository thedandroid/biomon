/* eslint-disable no-console */

const { resolveEntry, STRESS_TABLE, PANIC_TABLE } = require("../responseTables");

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assertion failed");
}

function checkTable(name, table, rollType) {
  assert(Array.isArray(table) && table.length > 0, `${name}: table missing`);

  // Basic shape + coverage sanity: ensure min/max exist and we can resolve across a broad span.
  for (const e of table) {
    assert(typeof e.min === "number" && typeof e.max === "number", `${name}: invalid range`);
    assert(typeof e.id === "string" && e.id.length, `${name}: missing id`);
    assert(typeof e.label === "string" && e.label.length, `${name}: missing label`);
  }

  for (let total = -10; total <= 30; total++) {
    const e = resolveEntry(rollType, total);
    assert(e && typeof e.id === "string", `${name}: failed to resolve for total=${total}`);
  }

  console.log(`${name}: OK (${table.length} entries)`);
}

function main() {
  checkTable("Stress Table", STRESS_TABLE, "stress");
  checkTable("Panic Table", PANIC_TABLE, "panic");
  console.log("Self-check complete.");
}

main();
