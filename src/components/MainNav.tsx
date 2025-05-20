
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Package,
  PlusCircle,
  Archive,
  PackageMinus,
  BarChart3,
  Settings, 
  Users, 
} from "lucide-react"

import { cn } from "@/lib/utils"
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  useSidebar,
} from "@/components/ui/sidebar"

const menuItems = [
  { href: "/", label: "仪表盘", icon: LayoutDashboard },
  { href: "/products", label: "产品管理", icon: Package },
  { href: "/products/add", label: "添加产品", icon: PlusCircle },
  { href: "/stock/intake", label: "库存入库", icon: Archive },
  { href: "/stock/outflow", label: "库存出库", icon: PackageMinus },
  { href: "/stock/valuation", label: "库存统计", icon: BarChart3 },
]

export function MainNav() {
  const pathname = usePathname()
  const { setOpenMobile } = useSidebar();

  const handleLinkClick = () => {
    setOpenMobile(false); 
  };

  return (
    <SidebarMenu>
      <SidebarGroup>
        <SidebarGroupLabel>菜单</SidebarGroupLabel>
        {menuItems.map(({ href, label, icon: Icon }) => (
          <SidebarMenuItem key={href}>
            <Link href={href} passHref legacyBehavior>
              <SidebarMenuButton
                asChild
                isActive={pathname === href}
                onClick={handleLinkClick}
                tooltip={label}
              >
                <a>
                  <Icon />
                  <span>{label}</span>
                </a>
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
        ))}
      </SidebarGroup>

      {/* 
      <SidebarGroup>
        <SidebarGroupLabel>设置</SidebarGroupLabel>
        <SidebarMenuItem>
          <Link href="/settings" passHref legacyBehavior>
            <SidebarMenuButton asChild isActive={pathname === "/settings"} onClick={handleLinkClick} tooltip="常规设置">
              <a><Settings /><span>设置</span></a>
            </SidebarMenuButton>
          </Link>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <Link href="/users" passHref legacyBehavior>
            <SidebarMenuButton asChild isActive={pathname === "/users"} onClick={handleLinkClick} tooltip="管理用户">
              <a><Users /><span>用户</span></a>
            </SidebarMenuButton>
          </Link>
        </SidebarMenuItem>
      </SidebarGroup> 
      */}
    </SidebarMenu>
  )
}

