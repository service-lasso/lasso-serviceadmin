import { screen } from '@testing-library/react'

export async function expectActivePageIdentity(identity: string) {
  expect(
    await screen.findByTestId('active-page-identity')
  ).toHaveAccessibleName(`Current page: ${identity}`)
}
