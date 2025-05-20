
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Package,
  PlusCircle,
  Archive,
  PackageMinus,
  BarChart3, // Keeping BarChart3 for Stock Analysis for now
  Settings,
  History, 
  Activity // Example for a new icon if needed, or use existing
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
  { href: "/stock-analysis", label: "库存分析", icon: BarChart3 }, // Updated label and href
]

const settingsMenuItems = [
 { href: "/settings", label: "设置", icon: Settings },
 { href: "/transactions", label: "交易记录", icon: History },
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

      <SidebarGroup>
        <SidebarGroupLabel>管理</SidebarGroupLabel>
        {settingsMenuItems.map(({ href, label, icon: Icon }) => (
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
    </SidebarMenu>
  )
}
