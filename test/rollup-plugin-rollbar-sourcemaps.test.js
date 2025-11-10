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

  describe('submitSourcemaps', function () {
    let submitSourcemaps;

    beforeEach(function () {
      submitSourcemaps = rollbarSourcemaps.__GetDependency__('submitSourcemaps');
    });

    it('should resume the response when the upload succeeds', async function () {
      expect.assertions(2);
      const resume = jest.fn();
      const submit = jest.fn((endpoint, cb) => {
        cb(null, { statusCode: 200, resume });
      });

      await submitSourcemaps({
        rollbarEndpoint: 'https://api.rollbar.test/api/1/sourcemap',
        silent: true,
        form: { submit },
      });

      expect(submit).toHaveBeenCalledTimes(1);
      expect(resume).toHaveBeenCalledTimes(1);
    });

    it('should log a success message when silent is false', async function () {
      expect.assertions(2);
      const resume = jest.fn();
      const submit = jest.fn((endpoint, cb) => {
        cb(null, { statusCode: 200, resume });
      });

      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await submitSourcemaps({
        rollbarEndpoint: 'https://api.rollbar.test/api/1/sourcemap',
        silent: false,
        form: { submit },
      });

      expect(submit).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith(
        'Sourcemaps successfully uploaded to Rollbar.'
      );

      logSpy.mockRestore();
    });

    it('should log the response body when the upload fails', async function () {
      expect.assertions(3);
      const { EventEmitter } = await import('events');
      const response = new EventEmitter();
      response.statusCode = 400;
      response.on = response.addListener.bind(response);
      response.once = response.once.bind(response);
      response.emitData = (data) => response.emit('data', data);
      response.emitEnd = () => response.emit('end');

      const submit = jest.fn((endpoint, cb) => {
        cb(null, response);
        process.nextTick(() => {
          response.emitData(Buffer.from('Bad request', 'utf8'));
          response.emitEnd();
        });
      });

      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await submitSourcemaps({
        rollbarEndpoint: 'https://api.rollbar.test/api/1/sourcemap',
        silent: true,
        form: { submit },
      });

      expect(submit).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith(
        'Sourcemaps failed to upload to Rollbar. The response from the api call is:'
      );
      expect(logSpy).toHaveBeenCalledWith('Bad request');

      logSpy.mockRestore();
    });

    it('should handle missing response.resume when the upload succeeds', async function () {
      expect.assertions(2);
      const submit = jest.fn((endpoint, cb) => {
        cb(null, { statusCode: 200 });
      });

      await expect(
        submitSourcemaps({
          rollbarEndpoint: 'https://api.rollbar.test/api/1/sourcemap',
          silent: true,
          form: { submit },
        })
      ).resolves.toBeUndefined();

      expect(submit).toHaveBeenCalledTimes(1);
    });

    it('should reject when the upload fails before getting a response', async function () {
      expect.assertions(1);
      const submit = jest.fn((endpoint, cb) => {
        cb(new Error('network failure'));
      });

      await expect(
        submitSourcemaps({
          rollbarEndpoint: 'https://api.rollbar.test/api/1/sourcemap',
          silent: true,
          form: { submit },
        })
      ).rejects.toThrow('network failure');
    });
  });

  describe('writeBundle manual execution', function () {
    it('should warn via this.warn when silent is false and no sourcemaps are found', async function () {
      expect.assertions(1);
      const plugin = rollbarSourcemaps(options);
      const warn = jest.fn();
      await plugin.writeBundle.call({ warn, warnOnce: warn }, {}, {});
      expect(warn).toHaveBeenCalledTimes(1);
    });

    it('should skip warnings when silent is true and no sourcemaps are found', async function () {
      expect.assertions(1);
      const plugin = rollbarSourcemaps({ ...options, silent: true });
      const warn = jest.fn();
      await plugin.writeBundle.call({ warn, warnOnce: warn }, {}, {});
      expect(warn).not.toHaveBeenCalled();
    });
  });
});
