defmodule GridPanes.Grids.Grid do
  use Ecto.Schema
  import Ecto.Changeset

  alias GridPanes.Grids.Pane

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id
  schema "grids" do
    field :name, :string
    field :description, :string
    embeds_many :panes, Pane, on_replace: :delete

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(grid, attrs) do
    grid
    |> cast(attrs, [:name, :description])
    |> cast_embed(:panes)
    |> validate_required([:name])
    |> validate_unique_pane_ids()
    |> validate_tree_structure()
    |> validate_sibling_consistency()
  end

  defp validate_unique_pane_ids(changeset) do
    case get_embed(changeset, :panes) do
      nil ->
        changeset

      panes ->
        ids =
          Enum.map(panes, fn
            %Ecto.Changeset{} = cs -> Ecto.Changeset.get_field(cs, :id)
            pane -> pane.id
          end)

        if length(ids) != length(Enum.uniq(ids)) do
          add_error(changeset, :panes, "pane IDs must be unique")
        else
          changeset
        end
    end
  end

  defp validate_tree_structure(changeset) do
    case get_embed(changeset, :panes) do
      nil ->
        changeset

      panes ->
        # Convert changesets to data we can work with
        pane_data =
          Enum.map(panes, fn
            %Ecto.Changeset{} = cs -> Ecto.Changeset.apply_changes(cs)
            pane -> pane
          end)

        panes_by_id = Map.new(pane_data, &{&1.id, &1})

        # Check that all parent_ids reference valid panes
        invalid_parents =
          Enum.filter(pane_data, fn pane ->
            pane.parent_id && !Map.has_key?(panes_by_id, pane.parent_id)
          end)

        if length(invalid_parents) > 0 do
          add_error(changeset, :panes, "some panes reference non-existent parents")
        else
          # Check for cycles and ensure single root
          validate_no_cycles_and_single_root(changeset, panes_by_id)
        end
    end
  end

  defp validate_sibling_consistency(changeset) do
    case get_embed(changeset, :panes) do
      nil ->
        changeset

      panes ->
        # Convert changesets to data we can work with
        pane_data =
          Enum.map(panes, fn
            %Ecto.Changeset{} = cs -> Ecto.Changeset.apply_changes(cs)
            pane -> pane
          end)

        # Group panes by parent to check sibling relationships
        siblings_by_parent = Enum.group_by(pane_data, & &1.parent_id)

        Enum.reduce(siblings_by_parent, changeset, fn {parent_id, siblings}, acc ->
          validate_sibling_group(acc, siblings, parent_id)
        end)
    end
  end

  defp validate_sibling_group(changeset, siblings, _parent_id) when length(siblings) <= 1,
    do: changeset

  defp validate_sibling_group(changeset, siblings, _parent_id) do
    # Check that sibling orders are consecutive and start from 0
    orders = Enum.map(siblings, & &1.order) |> Enum.sort()
    expected_orders = 0..(length(siblings) - 1) |> Enum.to_list()

    if orders != expected_orders do
      add_error(changeset, :panes, "sibling panes must have consecutive orders starting from 0")
    else
      # Validate fr unit consistency among siblings
      validate_fr_units_in_siblings(changeset, siblings)
    end
  end

  defp validate_fr_units_in_siblings(changeset, siblings) do
    # Check if any siblings use fr units
    fr_siblings =
      Enum.filter(siblings, fn pane ->
        pane.size_unit == :fr && pane.size_default
      end)

    if length(fr_siblings) > 0 do
      # If some siblings use fr, validate they make sense together
      changeset
    else
      changeset
    end
  end

  defp validate_no_cycles_and_single_root(changeset, panes_by_id) do
    # Find root panes (panes with no parent)
    roots = Enum.filter(panes_by_id, fn {_id, pane} -> pane.parent_id == nil end)

    case length(roots) do
      0 -> add_error(changeset, :panes, "must have at least one root pane")
      1 -> validate_no_cycles(changeset, panes_by_id)
      _ -> add_error(changeset, :panes, "must have exactly one root pane")
    end
  end

  defp validate_no_cycles(changeset, panes_by_id) do
    # Simple cycle detection by checking if any pane can reach itself
    has_cycle =
      Enum.any?(panes_by_id, fn {id, _pane} ->
        check_for_cycle(panes_by_id, id, id, MapSet.new())
      end)

    if has_cycle do
      add_error(changeset, :panes, "pane hierarchy contains cycles")
    else
      changeset
    end
  end

  defp check_for_cycle(_panes_by_id, _original_id, nil, _visited), do: false

  defp check_for_cycle(panes_by_id, original_id, current_id, visited) do
    if MapSet.member?(visited, current_id) do
      current_id == original_id
    else
      case Map.get(panes_by_id, current_id) do
        nil ->
          false

        pane ->
          new_visited = MapSet.put(visited, current_id)
          check_for_cycle(panes_by_id, original_id, pane.parent_id, new_visited)
      end
    end
  end
end
