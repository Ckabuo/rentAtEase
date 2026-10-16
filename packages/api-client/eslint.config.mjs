import base from "@rae/config/eslint/base";

export default [
  ...base,
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@prisma/*", "@rae/web", "@rae/api", "@rae/marketing"],
              message: "The API client is the only way the web app talks to the backend.",
            },
          ],
        },
      ],
    },
  },
];
