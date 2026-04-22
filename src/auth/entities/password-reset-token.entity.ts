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

const dateColumnType = (
  process.env.DB_TYPE === 'postgres' ? 'timestamptz' : 'datetime'
) as const;

@Entity('password_reset_tokens')
export class PasswordResetToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, (user: User) => user.passwordResetTokens, {
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
