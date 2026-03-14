import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from './user.schema';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) { }

  async create(tenantId: string, dto: Partial<User>): Promise<UserDocument> {
    const user = new this.userModel({
      ...dto,
      tenantId: new Types.ObjectId(tenantId),
    });
    return user.save();
  }

  async findByEmailForAuth(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email }).select('+passwordHash').exec();
  }

  async checkEmailExists(email: string): Promise<boolean> {
    const user = await this.userModel.findOne({ email } as any).exec();
    return !!user;
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  async findByIdWithPassword(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).select('+passwordHash').exec();
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await this.userModel.updateOne({ _id: new Types.ObjectId(id) } as any, {
      $set: { passwordHash },
    });
  }

  async findAllByTenant(tenantId: string): Promise<UserDocument[]> {
    return this.userModel
      .find({ tenantId: new Types.ObjectId(tenantId) } as any)
      .exec();
  }

  async findDoctorsByTenant(tenantId: string): Promise<UserDocument[]> {
    // Include both DOCTOR role and ADMIN users who have a doctorProfile
    return this.userModel
      .find({
        tenantId: new Types.ObjectId(tenantId),
        isActive: true,
        $or: [
          { role: 'DOCTOR' },
          { role: 'ADMIN' },
        ],
      } as any)
      .select('name email role doctorProfile')
      .lean()
      .exec() as any;
  }
}
