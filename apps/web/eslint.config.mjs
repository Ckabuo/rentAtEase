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
              group: ["@prisma/*", "@rae/api", "@rae/marketing"],
              message: "The web app talks to the API through @rae/api-client.",
            },
          ],
        },
      ],
    },
  },
];
