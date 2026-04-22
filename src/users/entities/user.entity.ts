import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Channel } from '../../channels/entities/channel.entity';
import { EmailVerificationToken } from '../../auth/entities/email-verification-token.entity';
import { PasswordResetToken } from '../../auth/entities/password-reset-token.entity';
import { Session } from '../../auth/entities/session.entity';

const dateColumnType = (
  process.env.DB_TYPE === 'postgres' ? 'timestamptz' : 'datetime'
) as const;

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 320 })
  email!: string;

  @Column({ type: 'varchar', length: 255 })
  passwordHash!: string;

  @Column({ type: 'boolean', default: false })
  isEmailVerified!: boolean;

  @OneToMany(() => Channel, (channel: Channel) => channel.owner)
  channels!: Channel[];

  @OneToMany(() => Session, (session: Session) => session.user)
  sessions!: Session[];

  @OneToMany(
    () => EmailVerificationToken,
    (verificationToken: EmailVerificationToken) => verificationToken.user,
  )
  emailVerificationTokens!: EmailVerificationToken[];

  @OneToMany(
    () => PasswordResetToken,
    (passwordResetToken: PasswordResetToken) => passwordResetToken.user,
  )
  passwordResetTokens!: PasswordResetToken[];

  @CreateDateColumn({ type: dateColumnType })
  createdAt!: Date;

  @UpdateDateColumn({ type: dateColumnType })
  updatedAt!: Date;
}
