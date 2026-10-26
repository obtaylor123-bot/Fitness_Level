export function canStartAuthentication(ageConfirmed: boolean, documentsAcknowledged: boolean): boolean {
  return ageConfirmed && documentsAcknowledged;
}
