export class AppError extends Error {constructor(message,status=400){super(message);this.status=status;}}
export const fail=(message,status)=>{throw new AppError(message,status)};
