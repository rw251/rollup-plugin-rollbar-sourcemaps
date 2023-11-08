import { rollup } from 'rollup';
import { join } from 'path';
import rollbarSourcemaps from '../src/rollup-plugin-rollbar-sourcemaps';
import { ROLLBAR_ENDPOINT } from '../src/constants';

process.chdir(join(__dirname, 'fixtures'));

function expectWarnings(warnings) {
  let warningIndex = 0;
  return jest.fn((warning) => {
    if (warningIndex >= warnings.length) {
      throw new Error(`Unexpected warning: "${warning.message}"`);
    } else {
      const expectedWarning = warnings[warningIndex];
      Object.keys(expectedWarning).forEach((key) => {
        expect(warning[key]).toEqual(expectedWarning[key]);
      });
    }
    warningIndex += 1;
  });
}

const expectNoWarnings = expectWarnings([]);

describe('rollup-plugin-rollbar-deploy', function () {
  let rollupPlugin;
  let options;
  beforeEach(function () {
    options = {
      accessToken: 'aaaabbbbccccddddeeeeffff00001111',
      baseUrl: '//test.com',
      version: 'df6a46e5465e465d4fa6',
    };

    rollupPlugin = rollbarSourcemaps(options);
  });

  describe('constructor', function () {
    it('should return an instance with the correct name', function () {
      expect(rollupPlugin.name).toBe('rollup-plugin-rollbar-sourcemaps');
    });

    it('should set options', function () {
      const localOptions = { ...this.options, silent: true };
      const localPlugin = rollbarSourcemaps(localOptions);
      expect(localPlugin).not.toBe(undefined);
      expect(localPlugin.localProps).toEqual(
        expect.objectContaining({ silent: true })
      );
    });

    it('should default silent to false', function () {
      expect(rollupPlugin.localProps).toEqual(
        expect.objectContaining({ silent: false })
      );
    });

    it('should default rollbarEndpoint to ROLLBAR_ENDPOINT constant', function () {
      expect(rollupPlugin.localProps).toEqual(
        expect.objectContaining({ rollbarEndpoint: ROLLBAR_ENDPOINT })
      );
    });

    it('should access string value for rollbarEndpoint', function () {
      const customEndpoint = 'https://api.rollbar.custom.com/api/1/sourcemap';
      const localOptions = { ...this.options, rollbarEndpoint: customEndpoint };
      const localPlugin = rollbarSourcemaps(localOptions);
      expect(localPlugin.localProps).toEqual(
        expect.objectContaining({ rollbarEndpoint: customEndpoint })
      );
    });
  });

  describe('apply', function () {
    it('should call submitSourcemaps', async function () {
      const mockSubmitSourcemaps = jest.fn();
      rollbarSourcemaps.__Rewire__('submitSourcemaps', mockSubmitSourcemaps);

      const bundle = await rollup({
        input: 'index.js',
        plugins: [rollbarSourcemaps(options)],
      });
      await bundle.write({ dir: 'output', format: 'umd', sourcemap: true });
      expect(mockSubmitSourcemaps.mock.calls.length).toBe(1);
      rollbarSourcemaps.__ResetDependency__('submitSourcemaps');
    });

    it('should call submitSourcemaps after writeBundle hook', async function () {
      const mockSubmitSourcemaps = jest.fn();
      rollbarSourcemaps.__Rewire__('submitSourcemaps', mockSubmitSourcemaps);

      expect(mockSubmitSourcemaps.mock.calls.length).toBe(0);
      const bundle = await rollup({
        input: 'index.js',
        plugins: [rollbarSourcemaps(options)],
      });
      expect(mockSubmitSourcemaps.mock.calls.length).toBe(0);
      await bundle.write({ dir: 'output', format: 'umd', sourcemap: true });
      expect(mockSubmitSourcemaps.mock.calls.length).toBe(1);
      rollbarSourcemaps.__ResetDependency__('submitSourcemaps');
    });

    it('should call submitSourcemaps with the correct parameters', async function () {
      const mockSubmitSourcemaps = jest.fn();
      rollbarSourcemaps.__Rewire__('submitSourcemaps', mockSubmitSourcemaps);

      const bundle = await rollup({
        input: 'index.js',
        plugins: [rollbarSourcemaps(options)],
      });
      await bundle.write({ dir: 'output', format: 'umd', sourcemap: true });
      expect(mockSubmitSourcemaps.mock.calls.length).toBe(1);
      expect(mockSubmitSourcemaps.mock.calls[0][0].silent).toBe(false);
      expect(mockSubmitSourcemaps.mock.calls[0][0].rollbarEndpoint).toBe(
        ROLLBAR_ENDPOINT
      );
      rollbarSourcemaps.__ResetDependency__('submitSourcemaps');
    });

    it('should call correctly without warnings', async function () {
      const mockSubmitSourcemaps = jest.fn();
      rollbarSourcemaps.__Rewire__('submitSourcemaps', mockSubmitSourcemaps);

      const bundle = await rollup({
        input: 'index.js',
        onwarn: expectNoWarnings,
        plugins: [rollbarSourcemaps(options)],
      });
      await bundle.write({ dir: 'output', format: 'umd', sourcemap: true });
      rollbarSourcemaps.__ResetDependency__('submitSourcemaps');
    });

    it('should warn if not sourcemaps found', async function () {
      const onwarn = expectWarnings([
        {
          code: 'PLUGIN_WARNING',
        },
      ]);
      const bundle = await rollup({
        input: 'index.js',
        onwarn,
        plugins: [rollbarSourcemaps(options)],
      });
      await bundle.write({ dir: 'output', format: 'umd' });
      expect(onwarn.mock.calls.length).toBe(1);
    });

    it("shouldn't call submitSourcemaps if not sourcemaps found", async function () {
      const mockSubmitSourcemaps = jest.fn();
      rollbarSourcemaps.__Rewire__('submitSourcemaps', mockSubmitSourcemaps);

      const bundle = await rollup({
        input: 'index.js',
        onwarn: () => {}, // suppress the warning that we know we'll get
        plugins: [rollbarSourcemaps(options)],
      });
      await bundle.write({ dir: 'output', format: 'umd' });
      expect(mockSubmitSourcemaps.mock.calls.length).toBe(0);
      rollbarSourcemaps.__ResetDependency__('submitSourcemaps');
    });
  });
});
