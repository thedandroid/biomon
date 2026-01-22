// Test file with intentional linting errors
const foo = "bar";   // missing semicolon
const unused = 123; // unused variable

function badIndent() {
  console.log("bad indentation");
}

module.exports = { foo };
