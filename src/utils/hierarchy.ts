import { ObjectId } from "mongodb";
import AdminModel from "@/models/admin.model";

interface HierarchyInfo {
  _id: string;
  user_name: string;
  name: string;
  type: string;
}

/**
 * Build top-down hierarchy for a given admin
 */
export async function buildHierarchy(adminId: string): Promise<HierarchyInfo[]> {
  const _adminId = new ObjectId(adminId);

  const admins = await AdminModel.aggregate([
    { $match: { _id: _adminId } },
    {
      $graphLookup: {
        from: "admins",
        startWith: "$sub_admin_list",  // traverse downwards
        connectFromField: "sub_admin_list",
        connectToField: "_id",
        as: "allSubAdmins",
      },
    },
    {
      $project: {
        current: {
          _id: "$_id",
          user_name: "$user_name",
          name: "$name",
          type: "$type",
        },
        subs: {
          $map: {
            input: "$allSubAdmins",
            as: "a",
            in: {
              _id: "$$a._id",
              user_name: "$$a.user_name",
              name: "$$a.name",
              type: "$$a.type",
            },
          },
        },
      },
    },
  ]);

  if (!admins.length) return [];

  const currentAdmin = admins[0].current;
  const subs = admins[0].subs;

  // Build top-down hierarchy array
  const hierarchy: HierarchyInfo[] = [currentAdmin, ...subs];

  return hierarchy;
}
