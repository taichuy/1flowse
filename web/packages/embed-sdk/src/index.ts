export interface EmbedContext {
  applicationId: string;
  teamId: string;
}

export function createEmbedContext(input: EmbedContext): EmbedContext {
  return input;
}
