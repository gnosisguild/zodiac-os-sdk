# Zodiac OS SDK

Programmatically manage [Zodiac](https://www.zodiac.eco) account constellations

## Getting started

### Generate a Zodiac OS API key

Sign in to https://app.zodiac.eco and create an API key at https://app.zodiac.eco/admin/api-keys

## API Client options

| Option      | Default                                    | Description                                                                                                                                                       |
| ----------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apiKey`    | `ZODIAC_OS_API_KEY`                        | Api key you created to access your Zodiac OS workspace. Can either be specified directly in code or through the `ZODIAC_OS_API_KEY` environment variable          |
| `workspace` | `ZODIAC_OS_WORKSPACE`                      | The Zodiac OS workspace you want to access with the client. Can also be specified via the `ZODIAC_OS_WORKSPACE` environment variable.                             |
| `baseUrl`   | `https://app.pilor.gnosisguild.org/api/v1` | The URL the API client will be pointed at. This can also be specified via the `ZODIAC_OS_API_URL` environment variable. You probably do not need to specify this. |
| `fetch`     | `global.fetch`                             | The `fetch` client that is used by the API client. You probably do not need to specify this. However, this can be useful for testing.                             |
