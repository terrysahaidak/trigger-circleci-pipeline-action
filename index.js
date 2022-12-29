import {
  getInput,
  setFailed,
  startGroup,
  endGroup,
  info,
  error as coreError,
} from "@actions/core";
import { context, getOctokit } from "@actions/github";
import axios from "axios";

const octokit = getOctokit(process.env.GITHUB_TOKEN);

startGroup("Preparing CircleCI Pipeline Trigger");
const repoOrg = context.repo.owner;
const repoName = context.repo.repo;
info(`Org: ${repoOrg}`);
info(`Repo: ${repoName}`);
const ref = context.ref;

// const getBranch = () => {
//   if (ref.startsWith("refs/heads/")) {
//     return ref.substring(11);
//   } else if (ref.startsWith("refs/pull/")) {
//     info(`This is a PR. Using head PR branch`);
//     const pullRequestNumber = ref.match(/refs\/pull\/([0-9]*)\//)[1];
//     const newref = `pull/${pullRequestNumber}/head`;
//     return newref;
//   }
//   return ref;
// };
const getTag = () => {
  if (ref.startsWith("refs/tags/")) {
    return ref.substring(10);
  }
};

const headers = {
  "content-type": "application/json",
  "x-attribution-login": context.actor,
  "x-attribution-actor-id": context.actor,
  "Circle-Token": `${process.env.CCI_TOKEN}`,
};
const parameters = {
  GHA_Actor: context.actor,
  GHA_Action: context.action,
  GHA_Event: context.eventName,
};

async function main() {
  let metaData = getInput("GHA_Meta");

  metaData = metaData.replace("/testflight", "");

  if (metaData.length > 0) {
    Object.assign(parameters, { GHA_Meta: metaData });
  }

  const body = {
    parameters: parameters,
  };

  const pr = await octokit.rest.pulls.get({
    ...context.repo,
    pull_number: context.payload.pull_request.number,
  });

  const tag = getTag();
  const branch = pr.data.head.ref; // getBranch();
  Object.assign(body, { branch });

  // if (tag) {
  //   Object.assign(body, { tag });
  // } else {
  // }

  const url = `https://circleci.com/api/v2/project/gh/${repoOrg}/${repoName}/pipeline`;

  info(`Triggering CircleCI Pipeline for ${repoOrg}/${repoName}`);
  info(`Triggering URL: ${url}`);
  if (tag) {
    info(`Triggering tag: ${tag}`);
  } else {
    info(`Triggering branch: ${branch}`);
  }
  info(`Parameters:\n${JSON.stringify(parameters)}`);
  endGroup();

  axios
    .post(url, body, { headers: headers })
    .then((response) => {
      startGroup("Successfully triggered CircleCI Pipeline");
      info(`CircleCI API Response: ${JSON.stringify(response.data)}`);
      endGroup();
    })
    .catch((error) => {
      startGroup("Failed to trigger CircleCI Pipeline");
      coreError(error);
      setFailed(error.message);
      endGroup();
    });
}

main();
