const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

const publicPath = path.resolve("./public");
const apiPath = path.join(publicPath, "api");

const apiResponses = {};

exports.onCreateNode = ({ node }) => {
  if (node.sourceInstanceName !== "source-yaml") {
    return;
  }

  if (node.internal.type === "Directory" && node.relativePath !== "") {
    const dirPath = path.join(apiPath, node.relativePath);
    apiResponses[dirPath] = {};

    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  if (node.internal.type === "File") {
    const filePath = path.join(apiPath, node.relativeDirectory, node.name);

    const json = yaml.load(node.internal.content);
    const value = Object.assign({}, json);
    if (!value.links) {
      value.links = [];
    }
    value.links.push({
      rel: ["self"],
      href: `/api/${path.join(node.relativeDirectory, node.name)}`,
    });
    if (fs.existsSync(publicPath)) {
      fs.writeFileSync(filePath, JSON.stringify(value));
    } else {
      apiResponses[node.relativeDirectory][node.name] = value;
    }
  }
};

exports.createPages = async ({ actions, graphql }, pluginOptions) => {
  const templates = pluginOptions.templates || [];
  const typeName = pluginOptions.typeName || "allYaml";

  const { data } = await graphql(`
    query {
      ${typeName} {
        edges {
          node {
            id
            class
            parent {
              ... on File {
                name
                relativeDirectory
              }
            }
          }
        }
      }
    }
  `);

  data[typeName].edges.forEach((edge) => {
    const klasses = edge.node.class;
    if (klasses.length === 0) {
      return;
    }

    const klass = klasses[0];
    const routePath = `${edge.node.parent.relativeDirectory}/${edge.node.parent.name}`;

    const template = templates[klass];
    if (!template) {
      return;
    }

    actions.createPage({
      path: `/${routePath}/`,
      component: template,
      context: { id: edge.node.id },
    });
  });
};

exports.onPostBootstrap = () => {
  for ([dir, responses] of Object.entries(apiResponses)) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    for ([key, value] of Object.entries(responses)) {
      const self = path.join(dir, key);
      if (!value.links) {
        value.links = [];
      }
      value.links.push({
        rel: ["self"],
        href: `/api/${self}`,
      });
      fs.writeFileSync(self, JSON.stringify(value));
    }
  }
};
