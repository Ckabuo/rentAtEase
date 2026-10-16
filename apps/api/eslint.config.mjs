import base from "@rae/config/eslint/base";

export default [
  { ignores: ["src/generated/**", "prisma-client/**"] },
  ...base,
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@rae/web", "@rae/marketing", "next", "next/*"],
              message: "The API does not import other apps.",
            },
          ],
        },
      ],
    },
  },
];
