import next from "eslint-config-next";

const nextConfig = Array.isArray(next) ? next : [next];

export default [
  ...nextConfig,
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@prisma/*", "@rae/api", "@rae/web"],
              message: "The marketing site does not import the product apps or the database.",
            },
          ],
        },
      ],
    },
  },
];
