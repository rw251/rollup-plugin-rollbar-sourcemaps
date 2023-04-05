// Custom rollup plugin for uploading rollbar deploys
import FormData from 'form-data';
import { ROLLBAR_ENDPOINT } from './constants';

const submitSourcemaps = ({ rollbarEndpoint, silent, form }) =>
  new Promise((resolve, reject) => {
    form.submit(rollbarEndpoint, (err, response) => {
      if (err) return reject(err);
      if (response.statusCode === 200) {
        if (!silent) {
          console.log('Sourcemaps successfully uploaded to Rollbar.');
        }
        return resolve();
      }
      let body = [];
      return response
        .on('data', (chunk) => {
          body.push(chunk);
        })
        .on('end', () => {
          body = Buffer.concat(body).toString();
          console.log(
            'Sourcemaps failed to upload to Rollbar. The response from the api call is:'
          );
          console.log(body);
          resolve();
        });
    });
  });

export default function rollbarSourcemaps({
  accessToken,
  version,
  baseUrl,
  silent = false,
  rollbarEndpoint = ROLLBAR_ENDPOINT,
}) {
  return {
    localProps: {
      accessToken,
      version,
      baseUrl,
      silent,
      rollbarEndpoint,
    },
    name: 'rollup-plugin-rollbar-sourcemaps',
    async writeBundle(options, bundle) {
      const possibleEntries = Object.entries(bundle).filter(
        (entry) => entry.length > 1 && entry[1]
      );
      const entryWithMap = possibleEntries.find((entry) => entry[1].map);
      if (!entryWithMap) {
        if (!silent) {
          this.warn({
            message: "Failed to upload sourcemaps - I couldn't find any!",
            code: 'NOT_THIS',
          });
        }
        return;
      }

      const sourceMapFileBuffer = Buffer.from(
        JSON.stringify(entryWithMap[1].map),
        'utf8'
      );

      const form = new FormData();
      form.append('source_map', sourceMapFileBuffer, {
        filename: `${entryWithMap[1].fileName}.map`,
        contentType: 'application/octet-stream',
      });
      form.append('access_token', accessToken);
      form.append('version', version);
      form.append('minified_url', `${baseUrl}${entryWithMap[1].fileName}`);

      await submitSourcemaps({ rollbarEndpoint, form, silent });
    },
  };
}
