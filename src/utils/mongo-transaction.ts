import mongoose, { type ClientSession } from 'mongoose';

export const runInTransaction = async <T>(handler: (session: ClientSession) => Promise<T>) => {
  const session = await mongoose.startSession();

  try {
    let result: T;

    await session.withTransaction(async () => {
      result = await handler(session);
    });

    return result!;
  } finally {
    await session.endSession();
  }
};
