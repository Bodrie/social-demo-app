import { type DeepMockProxy, mockDeep } from 'vitest-mock-extended';
import type { PrismaService } from '../prisma/prisma.service.js';
import { VisibilityService } from './visibility.service.js';

describe('VisibilityService.viewersOf', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let visibility: VisibilityService;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    visibility = new VisibilityService(prisma);
    prisma.user.count.mockResolvedValue(0);
    prisma.block.findMany.mockResolvedValue([]);
    prisma.mute.findMany.mockResolvedValue([]);
  });

  it('leaves out viewers on either side of a block with any subject, and viewers who muted one', async () => {
    prisma.block.findMany.mockResolvedValue([
      { blockerId: 'erin', blockedId: 'carol' }, // the viewer blocked the post's author
      { blockerId: 'carol', blockedId: 'gina' }, // the post's author blocked the viewer
    ] as never);
    prisma.mute.findMany.mockResolvedValue([{ muterId: 'dave' }] as never);

    await expect(
      visibility.viewersOf(['alice', 'dave', 'erin', 'gina'], ['bob', 'carol', 'bob']),
    ).resolves.toEqual(['alice']);
    expect(prisma.block.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            {
              blockerId: { in: ['alice', 'dave', 'erin', 'gina'] },
              blockedId: { in: ['bob', 'carol'] },
            },
            {
              blockerId: { in: ['bob', 'carol'] },
              blockedId: { in: ['alice', 'dave', 'erin', 'gina'] },
            },
          ],
        },
      }),
    );
  });

  it('keeps a viewer who is a subject too unless a block involves them', async () => {
    // "bob followed carol": carol follows bob and receives what is about her.
    await expect(visibility.viewersOf(['carol'], ['bob', 'carol'])).resolves.toEqual(['carol']);
  });

  it('answers nobody when a subject is suspended, and asks nothing for no viewers', async () => {
    prisma.user.count.mockResolvedValue(1);
    await expect(visibility.viewersOf(['alice'], ['bob'])).resolves.toEqual([]);

    prisma.user.count.mockClear();
    await expect(visibility.viewersOf([], ['bob'])).resolves.toEqual([]);
    expect(prisma.user.count).not.toHaveBeenCalled();
  });
});
