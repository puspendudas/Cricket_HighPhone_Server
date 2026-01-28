// services/hierarchy.service.ts
import { ObjectId, Types } from "mongoose";
import AdminModel from "@/models/admin.model";
import UserModel from "@/models/user.model";

/**
 * HierarchyService - Handles admin and user hierarchy operations
 *
 * This service provides methods for:
 * - Retrieving admin hierarchies
 * - Fetching all user IDs under an admin hierarchy
 * - Building admin hierarchies for requests
 */
class HierarchyService {
  private admin = AdminModel;
  private user = UserModel;

  /**
   * Get adminId + all descendant admin ids (ObjectId array)
   */
  public async getDescendantAdminIds(adminId: string | Types.ObjectId): Promise<Types.ObjectId[]> {
    const _id = typeof adminId === "string" ? new Types.ObjectId(adminId) : adminId;

    const res = await this.admin.aggregate([
      { $match: { _id } },
      {
        $graphLookup: {
          from: "admins",
          startWith: "$_id",
          connectFromField: "_id",
          connectToField: "parent_id",
          as: "descendants",
        },
      },
      {
        $project: {
          ids: { $concatArrays: [["$_id"], "$descendants._id"] },
        },
      },
    ]);

    const ids = res[0]?.ids || [];
    return ids.map((x: any) => new Types.ObjectId(x));
  }

  /**
   * Get all user ObjectIds whose agent_id belongs to adminId's descendant admins.
   */
  public async getAllUserIdsUnderAdmin(adminId: string | Types.ObjectId): Promise<Types.ObjectId[]> {
    const adminIds = await this.getDescendantAdminIds(adminId);
    if (!adminIds.length) return [];

    // NOTE: user model field is `agent_id`
    const users = await this.user.find({ agent_id: { $in: adminIds } }, { _id: 1 }).lean();
    return users.map((u: any) => new Types.ObjectId(u._id));
  }

  /**
   * For a list of agentIds, return a map: { agentIdStr: [ { _id, user_name, name, type }, ... ] }
   * Hierarchy order: agent (index 0) -> immediate parent -> ... -> top
   */
  public async getHierarchiesForAgents(agentIds: (string | Types.ObjectId)[]): Promise<Record<string, any[]>> {
    if (!agentIds?.length) return {};

    const _ids = agentIds.map((id) => (typeof id === "string" ? new Types.ObjectId(id) : id));

    const agg = await this.admin.aggregate([
      { $match: { _id: { $in: _ids } } },
      {
        $graphLookup: {
          from: "admins",
          startWith: "$parent_id",
          connectFromField: "parent_id",
          connectToField: "_id",
          as: "parents",
        },
      },
      {
        $project: {
          _id: 1,
          hierarchy: {
            $concatArrays: [
              [
                {
                  _id: "$_id",
                  user_name: "$user_name",
                  name: "$name",
                  type: "$type",
                },
              ],
              {
                $reverseArray: {
                  $map: {
                    input: "$parents",
                    as: "p",
                    in: {
                      _id: "$$p._id",
                      user_name: "$$p.user_name",
                      name: "$$p.name",
                      type: "$$p.type",
                    },
                  },
                },
              },
            ],
          },
        },
      },
    ]);

    const map: Record<string, any[]> = {};
    for (const d of agg) {
      map[d._id.toString()] = d.hierarchy || [];
    }
    return map;
  }

  /**
   * Slice the hierarchy up to cutoffAdminId (inclusive).
   * If cutoff not found, returns full hierarchy.
   */
  public sliceHierarchyToCutoff(hierarchy: any[], cutoffAdminId: string | Types.ObjectId) {
    if (!hierarchy || !hierarchy.length) return [];
    const cutoffStr = typeof cutoffAdminId === "string" ? cutoffAdminId : cutoffAdminId.toString();
    const idx = hierarchy.findIndex((h: any) => h._id?.toString() === cutoffStr);
    if (idx === -1) return hierarchy;
    return hierarchy.slice(0, idx + 1);
  }

  /**
   * Get immediate child admin ObjectIds for a given adminId (one level down)
   */
  public async getImmediateChildAdminIds(adminId: string | Types.ObjectId): Promise<Types.ObjectId[]> {
    const _id = typeof adminId === "string" ? new Types.ObjectId(adminId) : adminId;

    const children = await this.admin.find({ parent_id: _id }, { _id: 1 }).lean();
    return (children || []).map((a: any) => new Types.ObjectId(a._id));
  }

  /**
   * Get user ObjectIds whose agent_id is in the provided admin ids (exact match, no descendants)
   */
  public async getUserIdsForAgentIds(agentIds: (string | Types.ObjectId)[]): Promise<Types.ObjectId[]> {
    if (!agentIds?.length) return [];
    const _ids = agentIds.map((id) => (typeof id === "string" ? new Types.ObjectId(id) : id));
    const users = await this.user.find({ agent_id: { $in: _ids } }, { _id: 1 }).lean();
    return (users || []).map((u: any) => new Types.ObjectId(u._id));
  }

  /**
   * Get all child agent ObjectIds for a given admin (at any level).
   * Traverses the hierarchy recursively.
   */
  public async getChildAgentIds(adminId: string | Types.ObjectId): Promise<Types.ObjectId[]> {
    const visited = new Set<string>(); // to prevent circular references
    const agentIds: Types.ObjectId[] = [];

    const recurse = async (currentId: Types.ObjectId): Promise<void> => {
      if (visited.has(currentId.toString())) return;
      visited.add(currentId.toString());

      // Get all direct sub-admins
      const subAdmins = await this.admin.find({ parent_id: currentId }).select("_id type");

      for (const sub of subAdmins) {
        if (sub.type === "agent") {
          // ✅ Found agent-level admin
          agentIds.push(sub._id);
        } else {
          // 🔁 Go deeper until we find all agents under the hierarchy
          await recurse(sub._id);
        }
      }
    };

    await recurse(new Types.ObjectId(adminId));
    return agentIds;
  }

  // /**
  //  * Get all child agent ObjectIds for a given admin (at any level).
  //  * Traverses the hierarchy recursively.
  //  */
  // public async getChildAgentIdsForMultiple(adminIds: ObjectId[]): Promise<ObjectId[]> {
  //   const result = await this.admin.aggregate([
  //     {
  //       $match: { parent_id: { $in: adminIds } },
  //     },
  //     {
  //       $graphLookup: {
  //         from: "admins",
  //         startWith: "$_id",
  //         connectFromField: "_id",
  //         connectToField: "parent_id",
  //         as: "allChildren",
  //       },
  //     },
  //     {
  //       $project: {
  //         allAgents: {
  //           $filter: {
  //             input: "$allChildren",
  //             as: "child",
  //             cond: { $eq: ["$$child.type", "agent"] },
  //           },
  //         },
  //       },
  //     },
  //     { $unwind: "$allAgents" },
  //     { $replaceRoot: { newRoot: "$allAgents" } },
  //     { $project: { _id: 1 } },
  //   ]);
  //   return result.map((r) => r._id);
  // }

  /**
   * Get all agent ObjectIds under one or more admins (at any level in the hierarchy).
   *
   * Hierarchy: super_admin → admin → super_master → master → super_agent → agent → user
   *
   * - Works for any starting level in the chain.
   * - If you pass a master ID, it will fetch all agents below via super_agent → agent.
   * - If you pass a super_agent ID, it will fetch its immediate agent children.
   * - If you pass a higher-level admin, it will recurse through all levels until agents.
   */
  public async getChildAgentIdsForMultiple(adminIds: ObjectId[]): Promise<ObjectId[]> {
    const result = await this.admin.aggregate([
      // Match the starting admin IDs (roots)
      { $match: { _id: { $in: adminIds } } },

      // Recursively get all descendants (any level)
      {
        $graphLookup: {
          from: "admins",
          startWith: "$_id",
          connectFromField: "_id",
          connectToField: "parent_id",
          as: "descendants",
          maxDepth: 10, // safety to avoid infinite recursion
        },
      },

      // Combine the root + all descendants into one flat array
      {
        $project: {
          allAdmins: { $concatArrays: [["$$ROOT"], "$descendants"] },
        },
      },

      // Unwind so we can filter individual entries
      { $unwind: "$allAdmins" },

      // Filter only agent-type admins
      { $match: { "allAdmins.type": "agent" } },

      // Group and collect all unique agent IDs
      {
        $group: {
          _id: null,
          agentIds: { $addToSet: "$allAdmins._id" },
        },
      },
    ]);

    return result.length ? result[0].agentIds : [];
  }



}

export default HierarchyService;
