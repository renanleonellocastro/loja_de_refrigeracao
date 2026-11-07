/** An E2E test and the requirements its tags name. */
export interface TaggedTest {
  readonly file: string;
  readonly title: string;
  readonly requirements: readonly string[];
}

// The parts of the JSON reporter output (`playwright test --list --reporter=json`) the matrix reads.
interface ReportSpec {
  readonly title: string;
  readonly file: string;
  readonly tags: readonly string[];
}

interface ReportSuite {
  readonly title: string;
  readonly specs?: readonly ReportSpec[];
  readonly suites?: readonly ReportSuite[];
}

export interface Report {
  readonly suites: readonly ReportSuite[];
}

const REQUIREMENT_TAG = /^RF-\d{2}$/;

function toTest(spec: ReportSpec, describe: string): TaggedTest {
  const title = describe ? `${describe} › ${spec.title}` : spec.title;
  const requirements = spec.tags.filter((tag) => REQUIREMENT_TAG.test(tag));
  return { file: spec.file, title, requirements };
}

function walk(suite: ReportSuite, describe: string): TaggedTest[] {
  const own = (suite.specs ?? []).map((spec) => toTest(spec, describe));
  const nested = (suite.suites ?? []).flatMap((child) => walk(child, child.title));
  return [...own, ...nested];
}

/** The tests of the report that name at least one requirement, once each. */
export function collectTests(report: Report): TaggedTest[] {
  const tests = report.suites.flatMap((suite) => walk(suite, ''));
  const unique = new Map(tests.map((test) => [`${test.file}\n${test.title}`, test]));
  return [...unique.values()].filter((test) => test.requirements.length > 0);
}
