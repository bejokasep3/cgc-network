const {
  countUsersByType,
  projectsWithoutApplicants,
  creatorsWithoutProjects,
  collaborationsNearingDeadline,
} = require('./adminHealth');

const buildUser = (userType, state = 'active') => ({
  attributes: { state, profile: { publicData: { userType } } },
});

describe('countUsersByType', () => {
  it('counts active brands and creators separately', () => {
    const users = [buildUser('brand'), buildUser('brand'), buildUser('creator')];
    expect(countUsersByType(users)).toEqual({ brand: 2, creator: 1 });
  });

  it('ignores non-active users', () => {
    const users = [buildUser('brand', 'pendingApproval'), buildUser('creator')];
    expect(countUsersByType(users)).toEqual({ brand: 0, creator: 1 });
  });

  it('ignores operators', () => {
    const users = [buildUser('operator'), buildUser('creator')];
    expect(countUsersByType(users)).toEqual({ brand: 0, creator: 1 });
  });

  it('returns zeros for an empty list', () => {
    expect(countUsersByType([])).toEqual({ brand: 0, creator: 0 });
  });
});

describe('projectsWithoutApplicants', () => {
  const buildListing = (id, title) => ({ id: { uuid: id }, attributes: { title } });
  const buildApplicationTx = listingId => ({
    relationships: { listing: { data: { id: { uuid: listingId } } } },
  });

  it('excludes projects with at least one applicant', () => {
    const listings = [buildListing('p1', 'Project 1'), buildListing('p2', 'Project 2')];
    const applications = [buildApplicationTx('p1')];
    expect(projectsWithoutApplicants(listings, applications)).toEqual([
      { id: 'p2', title: 'Project 2' },
    ]);
  });

  it('returns every project when there are no applications at all', () => {
    const listings = [buildListing('p1', 'Project 1')];
    expect(projectsWithoutApplicants(listings, [])).toEqual([{ id: 'p1', title: 'Project 1' }]);
  });

  it('returns an empty array when every project has an applicant', () => {
    const listings = [buildListing('p1', 'Project 1')];
    const applications = [buildApplicationTx('p1')];
    expect(projectsWithoutApplicants(listings, applications)).toEqual([]);
  });
});

describe('creatorsWithoutProjects', () => {
  const buildListing = authorId => ({
    attributes: { title: 'Some package title' },
    relationships: { author: { data: { id: { uuid: authorId } } } },
  });
  const buildApplicationTx = customerId => ({
    relationships: { customer: { data: { id: { uuid: customerId } } } },
  });
  const authorsById = {
    c1: { attributes: { profile: { displayName: 'Jamie' } } },
    c2: { attributes: { profile: { displayName: 'Alex' } } },
  };

  it('excludes creators who have at least one application', () => {
    const listings = [buildListing('c1'), buildListing('c2')];
    const applications = [buildApplicationTx('c1')];
    expect(creatorsWithoutProjects(listings, applications, authorsById)).toEqual([
      { id: 'c2', displayName: 'Alex' },
    ]);
  });

  it('returns every creator when there are no applications at all', () => {
    const listings = [buildListing('c1')];
    expect(creatorsWithoutProjects(listings, [], authorsById)).toEqual([
      { id: 'c1', displayName: 'Jamie' },
    ]);
  });

  it('resolves the creator real display name, not the package listing title', () => {
    const listings = [buildListing('c1')];
    const result = creatorsWithoutProjects(listings, [], authorsById);
    expect(result[0].displayName).toBe('Jamie');
    expect(result[0].displayName).not.toBe('Some package title');
  });
});

describe('collaborationsNearingDeadline', () => {
  const now = new Date('2026-06-10T00:00:00.000Z');
  const buildTx = (id, projectId) => ({
    id: { uuid: id },
    attributes: { protectedData: { projectId } },
  });
  const buildProject = (id, title, contentDueDate) => ({
    id: { uuid: id },
    attributes: { title, publicData: { contentDueDate } },
  });

  it('includes a collaboration due within the window', () => {
    const txs = [buildTx('tx-1', 'p1')];
    const projectsById = { p1: buildProject('p1', 'Project 1', '2026-06-12T00:00:00.000Z') };
    const result = collaborationsNearingDeadline(txs, projectsById, { now, withinDays: 3 });
    expect(result).toHaveLength(1);
    expect(result[0].daysRemaining).toBe(2);
  });

  it('excludes a collaboration due well beyond the window', () => {
    const txs = [buildTx('tx-1', 'p1')];
    const projectsById = { p1: buildProject('p1', 'Project 1', '2026-07-01T00:00:00.000Z') };
    expect(collaborationsNearingDeadline(txs, projectsById, { now, withinDays: 3 })).toEqual([]);
  });

  it('includes an already-overdue collaboration with a negative daysRemaining', () => {
    const txs = [buildTx('tx-1', 'p1')];
    const projectsById = { p1: buildProject('p1', 'Project 1', '2026-06-05T00:00:00.000Z') };
    const result = collaborationsNearingDeadline(txs, projectsById, { now, withinDays: 3 });
    expect(result[0].daysRemaining).toBeLessThan(0);
  });

  it('skips a transaction whose project has no contentDueDate', () => {
    const txs = [buildTx('tx-1', 'p1')];
    const projectsById = { p1: buildProject('p1', 'Project 1', undefined) };
    expect(collaborationsNearingDeadline(txs, projectsById, { now })).toEqual([]);
  });

  it('skips a transaction whose project could not be found', () => {
    const txs = [buildTx('tx-1', 'missing-project')];
    expect(collaborationsNearingDeadline(txs, {}, { now })).toEqual([]);
  });

  it('sorts soonest-due first', () => {
    const txs = [buildTx('tx-1', 'p1'), buildTx('tx-2', 'p2')];
    const projectsById = {
      p1: buildProject('p1', 'Later', '2026-06-12T00:00:00.000Z'),
      p2: buildProject('p2', 'Sooner', '2026-06-11T00:00:00.000Z'),
    };
    const result = collaborationsNearingDeadline(txs, projectsById, { now, withinDays: 5 });
    expect(result.map(r => r.listingTitle)).toEqual(['Sooner', 'Later']);
  });
});
