// eslint-disable-next-line semi

const rules = {
  'array-bracket-spacing': [error, "always", { singleValue: false, objectsInArrays: false, arraysInArrays: false }],
}

module.exports = {
  extends: '@chatie',
  rules,
}
