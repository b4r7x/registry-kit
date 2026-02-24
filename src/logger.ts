export interface Logger {
  info: (message: string) => void;
}

export const defaultLogger: Logger = {
  info: (message: string) => console.log(message),
};
