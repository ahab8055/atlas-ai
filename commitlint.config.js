export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "header-max-length": [2, "always", 100],
    "subject-case": [0],
    "body-leading-blank": [2, "always"],
    "footer-leading-blank": [2, "always"],
  },
};
