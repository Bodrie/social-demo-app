import {
  apiErrorSchema,
  conversationListSchema,
  conversationSchema,
  markReadResultSchema,
  messageListSchema,
  messageSchema,
} from '@the-mesh/shared';
import request from 'supertest';
import { type TestApp, createTestApp } from './setup/app.js';
import { type CreatedUser, type TestAgent, createUser, login } from './setup/factories.js';

const GHOST = '00000000-0000-7000-8000-000000000000';

describe('conversations', () => {
  let t: TestApp;
  let alice: CreatedUser;
  let bob: CreatedUser;
  let carol: CreatedUser;
  let dave: CreatedUser;
  let aliceAgent: TestAgent;
  let bobAgent: TestAgent;
  let carolAgent: TestAgent;
  let daveAgent: TestAgent;

  const agentFor = async (user: CreatedUser): Promise<TestAgent> => {
    const agent = request.agent(t.server);
    await login(agent, user.email);
    return agent;
  };

  const conversation = async (agent: TestAgent, id: string, status = 200) => {
    const response = await agent.get(`/api/v1/conversations/${id}`).expect(status);
    return status === 200 ? conversationSchema.parse(response.body) : null;
  };

  const list = async (agent: TestAgent) =>
    conversationListSchema.parse((await agent.get('/api/v1/conversations').expect(200)).body);

  const createGroup = async (agent: TestAgent, title: string, memberIds: string[]) =>
    conversationSchema.parse(
      (await agent.post('/api/v1/conversations').send({ title, memberIds }).expect(201)).body,
    );

  const send = async (agent: TestAgent, id: string, content: string) =>
    messageSchema.parse(
      (await agent.post(`/api/v1/conversations/${id}/messages`).send({ content }).expect(201)).body,
    );

  const memberIds = (c: { members: { user: { id: string } }[] }) =>
    c.members.map((m) => m.user.id).toSorted();

  beforeAll(async () => {
    t = await createTestApp();
    [alice, bob, carol, dave] = await Promise.all([
      createUser(t.prisma),
      createUser(t.prisma),
      createUser(t.prisma),
      createUser(t.prisma),
    ]);
    [aliceAgent, bobAgent, carolAgent, daveAgent] = await Promise.all([
      agentFor(alice),
      agentFor(bob),
      agentFor(carol),
      agentFor(dave),
    ]);
  });

  afterAll(async () => {
    await t.app.close();
  });

  describe('direct conversations', () => {
    it('exist once per pair and are listed only once something was said', async () => {
      const mine = conversationSchema.parse(
        (await aliceAgent.put(`/api/v1/conversations/direct/${carol.id}`).expect(200)).body,
      );
      expect(mine).toMatchObject({ kind: 'direct', title: null, lastMessage: null });
      expect(memberIds(mine)).toEqual([alice.id, carol.id].toSorted());

      const theirs = conversationSchema.parse(
        (await carolAgent.put(`/api/v1/conversations/direct/${alice.id}`).expect(200)).body,
      );
      expect(theirs.id).toBe(mine.id);

      expect((await list(aliceAgent)).items.map((c) => c.id)).not.toContain(mine.id);
      expect(await conversation(carolAgent, mine.id)).toMatchObject({ id: mine.id });
      await conversation(bobAgent, mine.id, 404);

      await send(aliceAgent, mine.id, 'hi carol');
      expect((await list(aliceAgent)).items[0]).toMatchObject({ id: mine.id, unreadCount: 0 });
      expect((await list(carolAgent)).items[0]).toMatchObject({ id: mine.id, unreadCount: 1 });
    });

    it('treat an upper-case id as the same person (one thread per pair)', async () => {
      const lower = conversationSchema.parse(
        (await aliceAgent.put(`/api/v1/conversations/direct/${bob.id}`).expect(200)).body,
      );
      const upper = conversationSchema.parse(
        (await aliceAgent.put(`/api/v1/conversations/direct/${bob.id.toUpperCase()}`).expect(200))
          .body,
      );
      expect(upper.id).toBe(lower.id);
    });

    it('refuse yourself, strangers and malformed ids', async () => {
      await aliceAgent.put(`/api/v1/conversations/direct/${alice.id}`).expect(400);
      await aliceAgent.put(`/api/v1/conversations/direct/${GHOST}`).expect(404);
      const malformed = await aliceAgent.put('/api/v1/conversations/direct/nope').expect(400);
      expect(apiErrorSchema.parse(malformed.body)).toMatchObject({
        code: 'VALIDATION_ERROR',
        fields: { userId: expect.any(String) },
      });
    });
  });

  describe('groups', () => {
    it('are created with the creator and the chosen members, deduplicated, and shown at once', async () => {
      const group = conversationSchema.parse(
        (
          await aliceAgent
            .post('/api/v1/conversations')
            .send({ title: '  Trip  ', memberIds: [bob.id, bob.id, alice.id, carol.id] })
            .expect(201)
        ).body,
      );
      expect(group).toMatchObject({
        kind: 'group',
        title: 'Trip',
        createdById: alice.id,
        lastMessage: null,
        unreadCount: 0,
      });
      expect(memberIds(group)).toEqual([alice.id, bob.id, carol.id].toSorted());

      for (const agent of [aliceAgent, bobAgent, carolAgent]) {
        // oxlint-disable-next-line no-await-in-loop -- three small reads, order does not matter
        expect((await list(agent)).items.map((c) => c.id)).toContain(group.id);
      }
      await conversation(daveAgent, group.id, 404);
    });

    it('validate the form', async () => {
      const cases: [Record<string, unknown>, string][] = [
        [{ title: '', memberIds: [bob.id] }, 'title'],
        [{ title: 'x'.repeat(61), memberIds: [bob.id] }, 'title'],
        [{ title: 'Trip', memberIds: [] }, 'memberIds'],
        [{ title: 'Trip', memberIds: ['nope'] }, 'memberIds'],
        [{ title: 'Trip', memberIds: [alice.id] }, 'memberIds'],
        [{ title: 'Trip', memberIds: [GHOST] }, 'memberIds'],
      ];
      for (const [body, field] of cases) {
        // oxlint-disable-next-line no-await-in-loop -- each case is independent and the list is short
        const response = await aliceAgent.post('/api/v1/conversations').send(body).expect(400);
        // Array items are keyed by their index (`memberIds.0`), so match on the prefix.
        const fields = apiErrorSchema.parse(response.body).fields ?? {};
        expect(Object.keys(fields).some((key) => key.startsWith(field))).toBe(true);
      }
    });

    it('let members add people and leave; the last one out deletes the group', async () => {
      const group = await createGroup(aliceAgent, 'Movie night', [bob.id]);
      await send(aliceAgent, group.id, 'Friday?');

      // Only members change the member list.
      await daveAgent
        .post(`/api/v1/conversations/${group.id}/members`)
        .send({ userIds: [dave.id] })
        .expect(404);

      const grown = conversationSchema.parse(
        (
          await bobAgent
            .post(`/api/v1/conversations/${group.id}/members`)
            .send({ userIds: [carol.id, bob.id] })
            .expect(200)
        ).body,
      );
      expect(memberIds(grown)).toEqual([alice.id, bob.id, carol.id].toSorted());
      // Newcomers see the history and owe nothing they have not read.
      expect(await conversation(carolAgent, group.id)).toMatchObject({ unreadCount: 1 });

      const unchanged = conversationSchema.parse(
        (
          await aliceAgent
            .post(`/api/v1/conversations/${group.id}/members`)
            .send({ userIds: [carol.id] })
            .expect(200)
        ).body,
      );
      expect(unchanged.members).toHaveLength(3);

      await carolAgent.delete(`/api/v1/conversations/${group.id}/members/me`).expect(204);
      await conversation(carolAgent, group.id, 404);
      expect((await conversation(aliceAgent, group.id))?.members).toHaveLength(2);

      // Direct conversations have no member list to manage.
      const direct = conversationSchema.parse(
        (await aliceAgent.put(`/api/v1/conversations/direct/${bob.id}`).expect(200)).body,
      );
      await aliceAgent.delete(`/api/v1/conversations/${direct.id}/members/me`).expect(400);
      await aliceAgent
        .post(`/api/v1/conversations/${direct.id}/members`)
        .send({ userIds: [carol.id] })
        .expect(400);

      await bobAgent.delete(`/api/v1/conversations/${group.id}/members/me`).expect(204);
      await aliceAgent.delete(`/api/v1/conversations/${group.id}/members/me`).expect(204);
      await conversation(aliceAgent, group.id, 404);
      expect(await t.prisma.message.count({ where: { conversationId: group.id } })).toBe(0);
    });
  });

  describe('messages and read marks', () => {
    it('page newest first, count unread per member and move read marks forward only', async () => {
      const group = await createGroup(aliceAgent, 'Reading club', [bob.id, carol.id]);
      const sent = [];
      for (const [agent, text] of [
        [aliceAgent, 'a1'],
        [aliceAgent, 'a2'],
        [bobAgent, 'b1'],
        [aliceAgent, 'a3'],
        [bobAgent, 'b2'],
      ] as const) {
        // oxlint-disable-next-line no-await-in-loop -- sequential so createdAt orders them
        sent.push(await send(agent, group.id, text));
      }
      expect((await conversation(carolAgent, group.id))?.unreadCount).toBe(5);
      // Writing counts as reading: Bob wrote last, Alice has Bob's last one waiting.
      expect((await conversation(bobAgent, group.id))?.unreadCount).toBe(0);
      expect((await conversation(aliceAgent, group.id))?.unreadCount).toBe(1);

      const page1 = messageListSchema.parse(
        (await carolAgent.get(`/api/v1/conversations/${group.id}/messages?limit=2`).expect(200))
          .body,
      );
      expect(page1.items.map((m) => m.content)).toEqual(['b2', 'a3']);
      expect(page1.nextCursor).not.toBeNull();
      const page2 = messageListSchema.parse(
        (
          await carolAgent
            .get(`/api/v1/conversations/${group.id}/messages?limit=2&cursor=${page1.nextCursor}`)
            .expect(200)
        ).body,
      );
      expect(page2.items.map((m) => m.content)).toEqual(['b1', 'a2']);
      const page3 = messageListSchema.parse(
        (
          await carolAgent
            .get(`/api/v1/conversations/${group.id}/messages?limit=2&cursor=${page2.nextCursor}`)
            .expect(200)
        ).body,
      );
      expect(page3.items.map((m) => m.content)).toEqual(['a1']);
      expect(page3.nextCursor).toBeNull();

      const read = markReadResultSchema.parse(
        (await carolAgent.post(`/api/v1/conversations/${group.id}/read`).expect(200)).body,
      );
      expect(new Date(read.readAt).getTime()).toBeGreaterThanOrEqual(
        new Date(sent[4]?.createdAt ?? 0).getTime(),
      );
      expect((await conversation(carolAgent, group.id))?.unreadCount).toBe(0);
      const carolAsSeenByAlice = (await conversation(aliceAgent, group.id))?.members.find(
        (m) => m.user.id === carol.id,
      );
      expect(carolAsSeenByAlice?.lastReadAt).toBe(read.readAt);

      // Already caught up: the mark stays where it is.
      const again = markReadResultSchema.parse(
        (await carolAgent.post(`/api/v1/conversations/${group.id}/read`).expect(200)).body,
      );
      expect(again.readAt).toBe(read.readAt);

      await send(aliceAgent, group.id, 'a4');
      expect((await conversation(carolAgent, group.id))?.unreadCount).toBe(1);
    });

    it('keep non-members out and need text or a picture', async () => {
      const group = await createGroup(aliceAgent, 'Private', [bob.id]);
      await daveAgent.get(`/api/v1/conversations/${group.id}/messages`).expect(404);
      await daveAgent
        .post(`/api/v1/conversations/${group.id}/messages`)
        .send({ content: 'hello?' })
        .expect(404);
      await daveAgent.post(`/api/v1/conversations/${group.id}/read`).expect(404);

      const nothing = await aliceAgent
        .post(`/api/v1/conversations/${group.id}/messages`)
        .send({})
        .expect(400);
      expect(apiErrorSchema.parse(nothing.body).fields).toHaveProperty('content');
    });
  });
});
