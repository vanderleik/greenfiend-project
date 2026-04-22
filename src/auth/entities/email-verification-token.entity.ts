import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

const dateColumnType: 'timestamptz' | 'datetime' =
  process.env.DB_TYPE === 'postgres' ? 'timestamptz' : 'datetime';

@Entity('email_verification_tokens')
export class EmailVerificationToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, (user: User) => user.emailVerificationTokens, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  tokenHash!: string;

  @Index()
  @Column({ type: dateColumnType })
  expiresAt!: Date;

  @Column({ type: dateColumnType, nullable: true })
  consumedAt!: Date | null;

  @CreateDateColumn({ type: dateColumnType })
  createdAt!: Date;
}
