export interface IssueSource {
  name: string
  url: string
  apiKey: string
}

function env(name: string): string {
  return process.env[name] ?? ''
}

export const sources: IssueSource[] = [
  {
    name: 'Bhlogisticssystem',
    url: `${env('BHLOGISTICS_BASE_URL')}/api/issues`,
    apiKey: env('BHLOGISTICS_API_KEY'),
  },
  {
    name: 'PRsystem',
    url: `${env('PRSYSTEM_BASE_URL')}/api/issues`,
    apiKey: env('PRSYSTEM_API_KEY'),
  },
  {
    name: 'lms-casa',
    url: `${env('LMSCASA_BASE_URL')}/api/v1/issues`,
    apiKey: env('LMSCASA_API_KEY'),
  },
  {
    name: 'xBloom',
    url: `${env('XBLOOM_BASE_URL')}/issues`,
    apiKey: env('XBLOOM_API_KEY'),
  },
  {
    name: 'QSC-Sytem',
    url: `${env('QSC_BASE_URL')}/get_issues.php`,
    apiKey: env('QSC_API_KEY'),
  },
]
