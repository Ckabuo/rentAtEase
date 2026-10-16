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
              group: [
                "@prisma/*",
                "@nestjs/*",
                "next",
                "next/*",
                "react",
                "react-dom",
                "@rae/web",
                "@rae/api",
                "@rae/marketing",
              ],
              message: "Domain rules stay free of framework, database, and app imports.",
            },
          ],
        },
      ],
    },
  },
];
