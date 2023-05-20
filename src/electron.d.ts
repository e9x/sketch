declare module "electron" {
  export const shell: { openExternal(link: string): void };
}
