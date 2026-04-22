import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Channel } from './entities/channel.entity';
import { ChannelsService } from './channels.service';

describe('ChannelsService', () => {
  let service: ChannelsService;
  const existsMock = jest.fn();
  const createMock = jest.fn();
  const saveMock = jest.fn();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChannelsService,
        {
          provide: getRepositoryToken(Channel),
          useValue: {
            exists: existsMock,
            create: createMock,
            save: saveMock,
          },
        },
      ],
    }).compile();

    service = module.get<ChannelsService>(ChannelsService);
    existsMock.mockClear();
  });

  it('cria canal com slug baseado no email', async () => {
    const user = { id: 'u1', email: 'John.Doe@example.com' } as User;

    existsMock.mockResolvedValue(false);
    createMock.mockImplementation(
      (value: Partial<Channel>) => value as Channel,
    );
    saveMock.mockImplementation((value: Partial<Channel>) =>
      Promise.resolve({ id: 'c1', ...value } as Channel),
    );

    const channel = await service.createForUser(user);

    expect(channel.slug).toBe('john-doe');
    expect(existsMock).toHaveBeenCalledWith({ where: { slug: 'john-doe' } });
  });

  it('resolve colisao com sufixo incremental', async () => {
    const user = { id: 'u1', email: 'john@example.com' } as User;

    existsMock
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    createMock.mockImplementation(
      (value: Partial<Channel>) => value as Channel,
    );
    saveMock.mockImplementation((value: Partial<Channel>) =>
      Promise.resolve({ id: 'c1', ...value } as Channel),
    );

    const channel = await service.createForUser(user);

    expect(channel.slug).toBe('john-2');
  });
});
