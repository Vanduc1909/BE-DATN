import mongoose, { type ClientSession } from 'mongoose';

export const runInTransaction = async <T>(handler: (session: ClientSession) => Promise<T>) => {
  const session = await mongoose.startSession();

  try {
    let result: T;

    await session.withTransaction(async () => {
      result = await handler(session);
    });

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return result!;
  } finally {
    await session.endSession();
  }
};
