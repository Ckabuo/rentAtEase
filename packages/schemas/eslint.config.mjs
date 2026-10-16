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
              group: ["@rae/web", "@rae/api", "@rae/marketing", "@prisma/*"],
              message: "Schemas are shared contracts and must not import apps or the database.",
            },
          ],
        },
      ],
    },
  },
];
