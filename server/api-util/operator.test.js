const { isOperatorUserId, isOperatorUser } = require('./operator');

const withEnv = (value, fn) => {
  const original = process.env.CGC_OPERATOR_USER_IDS;
  process.env.CGC_OPERATOR_USER_IDS = value;
  try {
    fn();
  } finally {
    if (original === undefined) {
      delete process.env.CGC_OPERATOR_USER_IDS;
    } else {
      process.env.CGC_OPERATOR_USER_IDS = original;
    }
  }
};

describe('isOperatorUserId', () => {
  it('matches an id present in the comma-separated env var', () => {
    withEnv('user-1,user-2', () => {
      expect(isOperatorUserId('user-1')).toBe(true);
      expect(isOperatorUserId('user-2')).toBe(true);
    });
  });

  it('trims whitespace around each id', () => {
    withEnv(' user-1 , user-2 ', () => {
      expect(isOperatorUserId('user-1')).toBe(true);
      expect(isOperatorUserId('user-2')).toBe(true);
    });
  });

  it('rejects an id not in the list', () => {
    withEnv('user-1', () => {
      expect(isOperatorUserId('user-2')).toBe(false);
    });
  });

  it('rejects everything when the env var is unset', () => {
    withEnv(undefined, () => {
      expect(isOperatorUserId('user-1')).toBe(false);
    });
  });

  it('rejects a falsy id even if it somehow matched', () => {
    withEnv('', () => {
      expect(isOperatorUserId(null)).toBe(false);
      expect(isOperatorUserId(undefined)).toBe(false);
    });
  });
});

describe('isOperatorUser', () => {
  const buildUser = (userType, id) => ({
    id: { uuid: id },
    attributes: { profile: { publicData: { userType } } },
  });

  it('requires both userType "operator" and a listed id', () => {
    withEnv('op-1', () => {
      expect(isOperatorUser(buildUser('operator', 'op-1'))).toBe(true);
    });
  });

  it('rejects a listed id whose userType is not "operator"', () => {
    withEnv('op-1', () => {
      expect(isOperatorUser(buildUser('brand', 'op-1'))).toBe(false);
    });
  });

  it('rejects userType "operator" set by a user not on the allowlist', () => {
    withEnv('op-1', () => {
      expect(isOperatorUser(buildUser('operator', 'someone-else'))).toBe(false);
    });
  });

  it('rejects a missing user', () => {
    withEnv('op-1', () => {
      expect(isOperatorUser(null)).toBe(false);
      expect(isOperatorUser(undefined)).toBe(false);
    });
  });
});
