/**
 * The recall subject for each listable metric id (spec 06, design.md
 * "RECALL_SUBJECTS"). A subject fills the blank in a recall question such as
 * "What do you think {subject} cost then?".
 *
 * Each subject must pass checkRecallSubject from src/lib/recall. A test
 * (recall-subjects.test.ts) fails when one is missing or rejected. A subject
 * may not contain a digit, a direction word, or the metric's source or series
 * ID. EU subjects say "a thousand litres" because the sealed unit is
 * "EUR per 1,000 litres".
 *
 * The fixture subjects cover the fixture figures, which the page labels
 * "fixture data".
 */
export const RECALL_SUBJECTS: Readonly<Record<string, string>> = {
  "us-gasoline-regular": "a gallon of regular gasoline",
  "us-diesel": "a gallon of diesel",
  "eu-petrol-euro95": "a thousand litres of petrol",
  "eu-diesel": "a thousand litres of diesel",
  "fixture-us-gasoline-regular": "a gallon of regular gasoline in the fixture data",
  "fixture-us-diesel": "a gallon of diesel in the fixture data",
};
