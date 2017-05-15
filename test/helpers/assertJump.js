module.exports = function(error) {
  assert.isOk(/invalid (JUMP|opcode)/.test(error.message), 'Invalid JUMP error must be returned');
}
