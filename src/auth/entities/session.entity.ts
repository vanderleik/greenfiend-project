import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

const dateColumnType: 'timestamptz' | 'datetime' =
  process.env.DB_TYPE === 'postgres' ? 'timestamptz' : 'datetime';

@Entity('sessions')
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, (user: User) => user.sessions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'varchar', length: 255 })
  refreshTokenHash!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  userAgent!: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  ipAddress!: string | null;

  @Index()
  @Column({ type: dateColumnType })
  expiresAt!: Date;

  @Column({ type: dateColumnType, nullable: true })
  revokedAt!: Date | null;

  @CreateDateColumn({ type: dateColumnType })
  createdAt!: Date;

  @UpdateDateColumn({ type: dateColumnType })
  updatedAt!: Date;
}
