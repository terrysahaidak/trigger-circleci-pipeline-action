import {
  setFailed,
  startGroup,
  endGroup,
  info,
  error as coreError,
} from "@actions/core";
import { context, getOctokit } from "@actions/github";
import axios from "axios";

const octokit = getOctokit(process.env.GITHUB_TOKEN);
const actionContext = JSON.parse(process.env.GITHUB_CONTEXT);

startGroup("Preparing CircleCI Pipeline Trigger");
const repoOrg = context.repo.owner;
const repoName = context.repo.repo;
info(`Org: ${repoOrg}`);
info(`Repo: ${repoName}`);

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
// const getTag = () => {
//   if (ref.startsWith("refs/tags/")) {
//     return ref.substring(10);
//   }
// };

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
  const pr = await octokit.rest.pulls.get({
    ...context.repo,
    pull_number: actionContext.event.issue.number,
  });

  const branch = `${pr.data.head.ref}#${pr.data.head.sha}`;

  const matchedTickedNumber = pr.data.body.match(/SUPMOBILE-\d+/);

  const maybeTicketNumber = matchedTickedNumber
    ? `- ${matchedTickedNumber[0]}`
    : "";

  const testDetails = actionContext.event.comment.body
    .replace("/testflight", "")
    .trim();

  const metaData = `DEV BUILD!!!
${pr.data.title} ${maybeTicketNumber}
for branch ${branch}
trigger by @${actionContext.triggering_actor}
What to test:
${testDetails}
`;

  const body = {
    parameters: parameters,
    branch: pr.data.head.ref,
    GHA_Meta: metaData,
  };

  const url = `https://circleci.com/api/v2/project/gh/${repoOrg}/${repoName}/pipeline`;

  info(`Triggering CircleCI Pipeline for ${repoOrg}/${repoName}`);
  info(`Triggering URL: ${url}`);

  info(`Triggering branch: ${branch}`);

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
