const { daysRemaining, milestoneForDaysRemaining, buildReminderJobs } = require('./reminders');

describe('daysRemaining', () => {
  it('rounds up to a whole number of days', () => {
    const now = new Date('2026-06-10T00:00:00.000Z');
    expect(daysRemaining('2026-06-12T00:00:00.000Z', now)).toBe(2);
  });

  it('is negative once the due date has passed', () => {
    const now = new Date('2026-06-10T00:00:00.000Z');
    expect(daysRemaining('2026-06-05T00:00:00.000Z', now)).toBeLessThan(0);
  });
});

describe('milestoneForDaysRemaining', () => {
  it('returns h3 at exactly 3 days remaining', () => {
    expect(milestoneForDaysRemaining(3)).toBe('h3');
  });

  it('returns h1 at exactly 1 day remaining', () => {
    expect(milestoneForDaysRemaining(1)).toBe('h1');
  });

  it('returns overdue once past the due date', () => {
    expect(milestoneForDaysRemaining(-1)).toBe('overdue');
    expect(milestoneForDaysRemaining(-30)).toBe('overdue');
  });

  it('returns null for a day that is not a milestone', () => {
    expect(milestoneForDaysRemaining(5)).toBeNull();
    expect(milestoneForDaysRemaining(2)).toBeNull();
    expect(milestoneForDaysRemaining(0)).toBeNull();
  });
});

describe('buildReminderJobs', () => {
  const now = new Date('2026-06-10T00:00:00.000Z');

  const buildTx = ({ id = 'tx-1', projectId = 'p1', providerId = 'creator-1', remindersSent = [] } = {}) => ({
    id: { uuid: id },
    attributes: { protectedData: { projectId }, metadata: { remindersSent } },
    relationships: { provider: { data: { id: { uuid: providerId } } } },
  });

  const buildProject = (id, title, contentDueDate) => ({
    id: { uuid: id },
    attributes: { title, publicData: { contentDueDate } },
  });

  it('creates a job for a transaction hitting the h3 milestone', () => {
    const tx = buildTx();
    const projectsById = { p1: buildProject('p1', 'Summer campaign', '2026-06-13T00:00:00.000Z') };
    const jobs = buildReminderJobs([tx], projectsById, now);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toEqual(
      expect.objectContaining({
        transactionId: 'tx-1',
        providerId: 'creator-1',
        projectTitle: 'Summer campaign',
        milestone: 'h3',
      })
    );
  });

  it('skips a milestone already recorded in remindersSent', () => {
    const tx = buildTx({ remindersSent: ['h3'] });
    const projectsById = { p1: buildProject('p1', 'Summer campaign', '2026-06-13T00:00:00.000Z') };
    expect(buildReminderJobs([tx], projectsById, now)).toEqual([]);
  });

  it('does not skip a DIFFERENT milestone even if one was already sent', () => {
    const tx = buildTx({ remindersSent: ['h3'] });
    // now h1-away
    const projectsById = { p1: buildProject('p1', 'Summer campaign', '2026-06-11T00:00:00.000Z') };
    const jobs = buildReminderJobs([tx], projectsById, now);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].milestone).toBe('h1');
    expect(jobs[0].remindersSentBefore).toEqual(['h3']);
  });

  it('skips a transaction whose project has no contentDueDate', () => {
    const tx = buildTx();
    const projectsById = { p1: buildProject('p1', 'Summer campaign', undefined) };
    expect(buildReminderJobs([tx], projectsById, now)).toEqual([]);
  });

  it('skips a transaction whose project could not be found', () => {
    const tx = buildTx({ projectId: 'missing' });
    expect(buildReminderJobs([tx], {}, now)).toEqual([]);
  });

  it('skips a day with no applicable milestone', () => {
    const tx = buildTx();
    const projectsById = { p1: buildProject('p1', 'Summer campaign', '2026-06-20T00:00:00.000Z') };
    expect(buildReminderJobs([tx], projectsById, now)).toEqual([]);
  });

  it('skips a transaction with no provider relationship', () => {
    const tx = buildTx();
    delete tx.relationships.provider;
    const projectsById = { p1: buildProject('p1', 'Summer campaign', '2026-06-13T00:00:00.000Z') };
    expect(buildReminderJobs([tx], projectsById, now)).toEqual([]);
  });

  it('only sends the overdue reminder once even many days after it fires', () => {
    const tx = buildTx({ remindersSent: ['h3', 'h1', 'overdue'] });
    const projectsById = { p1: buildProject('p1', 'Summer campaign', '2026-05-01T00:00:00.000Z') };
    expect(buildReminderJobs([tx], projectsById, now)).toEqual([]);
  });

  it('handles multiple transactions independently', () => {
    const tx1 = buildTx({ id: 'tx-1', projectId: 'p1' });
    const tx2 = buildTx({ id: 'tx-2', projectId: 'p2', providerId: 'creator-2' });
    const projectsById = {
      p1: buildProject('p1', 'Campaign A', '2026-06-13T00:00:00.000Z'),
      p2: buildProject('p2', 'Campaign B', '2026-06-11T00:00:00.000Z'),
    };
    const jobs = buildReminderJobs([tx1, tx2], projectsById, now);
    expect(jobs).toHaveLength(2);
    expect(jobs.map(j => j.milestone)).toEqual(['h3', 'h1']);
  });
});
