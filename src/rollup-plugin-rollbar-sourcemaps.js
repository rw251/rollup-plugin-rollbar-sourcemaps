// Custom rollup plugin for uploading rollbar deploys
import FormData from 'form-data';

const submitSourcemaps = ({ rollbarEndpoint, silent, form }) => new Promise((resolve, reject) => {
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
        console.log('Sourcemaps failed to upload to Rollbar. The response from the api call is:');
        console.log(body);
        resolve();
      });
  });
});

export default function rollbarSourcemaps({
  accessToken,
  revision,
  environment,
  localUsername,
  silent = false,
  rollbarEndpoint = 'https://api.rollbar.com/api/1/sourcemaps',
}) {
  return {
    localProps: {
      accessToken,
      revision,
      environment,
      localUsername,
      silent,
      rollbarEndpoint
    },
    name: 'rollup-plugin-rollbar-sourcemaps',
    async writeBundle() {
      const form = new FormData();
      if (localUsername) form.append('local_username', localUsername);
      form.append('access_token', accessToken);
      form.append('revision', revision);
      form.append('environment', environment);

      await submitSourcemaps({ rollbarEndpoint, form, silent });
    },
  };
}
