/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  setupFiles: ['<rootDir>/tests/setup-env.ts'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup-after-env.ts'],
  clearMocks: true,
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^@controllers/(.*)$': '<rootDir>/src/controllers/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@models/(.*)$': '<rootDir>/src/models/$1',
    '^@middlewares/(.*)$': '<rootDir>/src/middlewares/$1',
    '^@validators/(.*)$': '<rootDir>/src/validators/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@routes/(.*)$': '<rootDir>/src/routes/$1',
    '^@sockets/(.*)$': '<rootDir>/src/sockets/$1'
  },
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.json'
      }
    ]
  }
};
