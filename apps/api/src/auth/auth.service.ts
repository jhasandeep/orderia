import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import * as bcrypt from "bcryptjs";
import { Repository } from "typeorm";
import { Membership, User } from "../entities";
import { LoginDto, RegisterDto } from "./auth.dto";

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private users: Repository<User>,
    @InjectRepository(Membership) private memberships: Repository<Membership>,
    private jwt: JwtService,
  ) {}

  private publicUser(u: User) {
    return { id: u.id, name: u.name, email: u.email, phone: u.phone, isPlatformAdmin: u.isPlatformAdmin };
  }

  private token(u: User) {
    return this.jwt.sign({ sub: u.id, email: u.email, admin: u.isPlatformAdmin || undefined });
  }

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    if (await this.users.findOne({ where: { email } })) throw new ConflictException("An account with this email already exists.");
    const user = await this.users.save(this.users.create({ email, name: dto.name.trim(), phone: dto.phone ?? null, passwordHash: await bcrypt.hash(dto.password, 10) }));
    return { token: this.token(user), user: this.publicUser(user) };
  }

  async login(dto: LoginDto) {
    const user = await this.users.findOne({ where: { email: dto.email.trim().toLowerCase() } });
    // same message for "no such user" and "wrong password", so emails cannot be probed
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) throw new UnauthorizedException("Wrong email or password.");
    return { token: this.token(user), user: this.publicUser(user) };
  }

  /** The user and every business they work for, with their role there. */
  async me(userId: string) {
    const user = await this.users.findOneOrFail({ where: { id: userId } });
    const rows = await this.memberships.find({ where: { userId }, relations: { business: true } });
    return {
      user: this.publicUser(user),
      memberships: rows.map((m) => ({ role: m.role, business: { id: m.business.id, slug: m.business.slug, name: m.business.name, type: m.business.type, modules: m.business.modules } })),
    };
  }
}
